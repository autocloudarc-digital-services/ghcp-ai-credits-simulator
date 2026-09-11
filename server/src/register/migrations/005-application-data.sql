BEGIN;
SELECT pg_advisory_xact_lock(84017001);
SELECT 'CREATE ROLE application_data NOLOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'application_data') \gexec
GRANT application_data TO register_authenticator;
GRANT USAGE ON SCHEMA register TO application_data;
CREATE TABLE IF NOT EXISTS register.assessment_jobs (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL CHECK (owner_id ~ '^[1-9][0-9]{0,19}$'),
  status text NOT NULL CHECK (status IN ('pending', 'complete', 'failed')),
  input jsonb NOT NULL,
  result jsonb,
  error text,
  lease_expires_at timestamptz NOT NULL DEFAULT now() + interval '2 minutes',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assessment_jobs_owner ON register.assessment_jobs(owner_id, created_at DESC);
CREATE TABLE IF NOT EXISTS register.workflows (
  owner_id text PRIMARY KEY CHECK (owner_id ~ '^[1-9][0-9]{0,19}$'),
  document jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS register.generated_reports (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL CHECK (owner_id ~ '^[1-9][0-9]{0,19}$'),
  filename text NOT NULL,
  pdf_base64 text NOT NULL,
  input jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS generated_reports_owner ON register.generated_reports(owner_id, created_at DESC);
ALTER TABLE register.assessment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE register.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE register.generated_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_assessments ON register.assessment_jobs;
CREATE POLICY own_assessments ON register.assessment_jobs TO application_data
  USING (owner_id = current_setting('request.jwt.claims', true)::jsonb->>'sub')
  WITH CHECK (owner_id = current_setting('request.jwt.claims', true)::jsonb->>'sub');
DROP POLICY IF EXISTS own_workflow ON register.workflows;
CREATE POLICY own_workflow ON register.workflows TO application_data
  USING (owner_id = current_setting('request.jwt.claims', true)::jsonb->>'sub')
  WITH CHECK (owner_id = current_setting('request.jwt.claims', true)::jsonb->>'sub');
DROP POLICY IF EXISTS own_reports ON register.generated_reports;
CREATE POLICY own_reports ON register.generated_reports TO application_data
  USING (owner_id = current_setting('request.jwt.claims', true)::jsonb->>'sub')
  WITH CHECK (owner_id = current_setting('request.jwt.claims', true)::jsonb->>'sub');
GRANT SELECT, INSERT, UPDATE ON register.assessment_jobs TO application_data;
GRANT SELECT, INSERT ON register.generated_reports TO application_data;
GRANT SELECT ON register.workflows TO application_data;
CREATE OR REPLACE FUNCTION register.save_workflow(candidate jsonb, expected_revision integer)
RETURNS SETOF register.workflows LANGUAGE plpgsql SECURITY DEFINER SET search_path = register, pg_temp AS $$
DECLARE actor text := current_setting('request.jwt.claims', true)::jsonb->>'sub';
BEGIN
  IF actor IS NULL OR actor !~ '^[1-9][0-9]{0,19}$' OR jsonb_typeof(candidate) <> 'object' THEN
    RAISE EXCEPTION 'Invalid workflow owner or document' USING ERRCODE = '22023';
  END IF;
  IF expected_revision = 0 THEN
    RETURN QUERY INSERT INTO register.workflows(owner_id, document) VALUES(actor, candidate) RETURNING *;
  ELSE
    RETURN QUERY UPDATE register.workflows SET document = candidate, revision = revision + 1, updated_at = now()
      WHERE owner_id = actor AND revision = expected_revision RETURNING *;
    IF NOT FOUND THEN RAISE EXCEPTION 'Workflow revision conflict' USING ERRCODE = 'PT409'; END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION register.save_workflow(jsonb, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register.save_workflow(jsonb, integer) TO application_data;
COMMIT;