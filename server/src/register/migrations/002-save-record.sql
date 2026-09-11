BEGIN;
SELECT pg_advisory_xact_lock(84017001);
CREATE OR REPLACE FUNCTION register.save_record(candidate jsonb, expected_revision integer, record_id uuid DEFAULT NULL)
RETURNS register.records
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, register AS $$
DECLARE
  claims jsonb := current_setting('request.jwt.claims', true)::jsonb;
  prior register.records;
  saved register.records;
  field_name text;
  phase_names text[] := ARRAY['Prepare','Baseline','Design','Approve','Pilot','Rollout','Operate'];
BEGIN
  IF COALESCE(claims->>'tenant','') = '' OR COALESCE(claims->>'sub','') = '' OR
     COALESCE(claims->>'access','') NOT IN ('editor','approver') THEN
    RAISE EXCEPTION 'Register write access denied' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(candidate) IS DISTINCT FROM 'object' OR
     COALESCE(candidate->>'record_type','') NOT IN ('policy-profile','ULB','entitlement-baseline','included-usage-control','metered-budget','license-baseline','rollout-wave','controlled-test','exception') OR
     COALESCE(candidate->>'scope_id','') = '' OR COALESCE(candidate->>'enterprise_control_id','') = '' OR
     COALESCE(candidate->>'owner_primary','') = '' OR NOT COALESCE(candidate->>'phase' = ANY(phase_names), false) THEN
    RAISE EXCEPTION 'Invalid register identity or phase' USING ERRCODE = '22023';
  END IF;
  IF record_id IS NULL THEN
    IF expected_revision IS DISTINCT FROM 0 OR candidate->>'phase' <> 'Prepare' THEN
      RAISE EXCEPTION 'Create records in Prepare at revision zero' USING ERRCODE = '22023';
    END IF;
    INSERT INTO register.records(tenant_id, document) VALUES (claims->>'tenant', candidate) RETURNING * INTO saved;
  ELSE
    SELECT * INTO prior FROM register.records WHERE id = record_id AND tenant_id = claims->>'tenant' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Record not found' USING ERRCODE = 'P0002'; END IF;
    IF prior.revision IS DISTINCT FROM expected_revision THEN
      RAISE EXCEPTION 'Revision conflict; reload before saving' USING ERRCODE = 'PT409';
    END IF;
    FOREACH field_name IN ARRAY ARRAY['record_type','scope_id','enterprise_control_id','policy_or_profile','profile_version'] LOOP
      IF prior.document->field_name IS DISTINCT FROM candidate->field_name THEN
        RAISE EXCEPTION 'Canonical identity is immutable' USING ERRCODE = '22023';
      END IF;
    END LOOP;
    IF array_position(phase_names,candidate->>'phase') - array_position(phase_names,prior.document->>'phase') NOT BETWEEN 0 AND 1 THEN
      RAISE EXCEPTION 'Invalid phase transition' USING ERRCODE = '22023';
    END IF;
    IF (candidate->'approval_id' IS DISTINCT FROM prior.document->'approval_id' OR
        candidate->'approval_outcome' IS DISTINCT FROM prior.document->'approval_outcome' OR
        (candidate->>'phase' = 'Approve' AND prior.document->>'phase' <> 'Approve')) AND claims->>'access' <> 'approver' THEN
      RAISE EXCEPTION 'Approver role required' USING ERRCODE = '42501';
    END IF;
    UPDATE register.records SET document = candidate, revision = revision + 1, updated_at = now()
      WHERE id = record_id RETURNING * INTO saved;
  END IF;
  INSERT INTO register.revisions(record_id,tenant_id,revision,document,actor_id)
    VALUES(saved.id,saved.tenant_id,saved.revision,saved.document,claims->>'sub');
  RETURN saved;
END;
$$;
REVOKE ALL ON FUNCTION register.save_record(jsonb,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register.save_record(jsonb,integer,uuid) TO register_api;
COMMIT;