BEGIN;
SELECT pg_advisory_xact_lock(84017001);

ALTER TABLE register.assessment_jobs ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0);
ALTER TABLE register.generated_reports ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0);
ALTER TABLE register.records ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0);
ALTER TABLE register.revisions ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0);

CREATE TABLE IF NOT EXISTS register.workflow_revisions (
  owner_id text NOT NULL REFERENCES register.workflows(owner_id),
  revision integer NOT NULL CHECK (revision > 0),
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  schema_version integer NOT NULL CHECK (schema_version > 0),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  origin text NOT NULL CHECK (origin IN ('legacy-baseline', 'workflow-save')),
  PRIMARY KEY (owner_id, revision)
);
ALTER TABLE register.workflow_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_workflow_revisions ON register.workflow_revisions;
CREATE POLICY own_workflow_revisions ON register.workflow_revisions FOR SELECT TO application_data
  USING (owner_id = current_setting('request.jwt.claims', true)::jsonb->>'sub');
GRANT SELECT ON register.workflow_revisions TO application_data;
REVOKE INSERT, UPDATE, DELETE ON register.workflow_revisions FROM application_data;

INSERT INTO register.workflow_revisions(owner_id, revision, document, schema_version, origin)
  SELECT owner_id, revision, document, 1, 'legacy-baseline' FROM register.workflows
  ON CONFLICT (owner_id, revision) DO NOTHING;

CREATE OR REPLACE FUNCTION register.validate_workflow_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = register, pg_temp AS $$
BEGIN
  IF NEW.document ? 'schemaVersion' AND NEW.document->'schemaVersion' IS DISTINCT FROM '1'::jsonb THEN
    RAISE EXCEPTION 'Unsupported workflow schema version' USING ERRCODE = '22023';
  END IF;
  NEW.document := NEW.document || jsonb_build_object('schemaVersion', 1);
  IF NEW.document->'hasReviewedDashboard' = 'true'::jsonb THEN
    IF NEW.document->'hasConfirmedSimulation' IS DISTINCT FROM 'true'::jsonb
      OR NEW.document->>'assessmentId' IS NULL
      OR NEW.document->>'simulatorResult' IS NULL THEN
      RAISE EXCEPTION 'Review requires an assessment and confirmed simulation' USING ERRCODE = '22023';
    END IF;
    IF TG_OP = 'UPDATE' AND (
      OLD.document->'assessmentId' IS DISTINCT FROM NEW.document->'assessmentId'
      OR OLD.document->'simulatorConfig' IS DISTINCT FROM NEW.document->'simulatorConfig'
      OR OLD.document->'simulatorResult' IS DISTINCT FROM NEW.document->'simulatorResult'
    ) THEN
      RAISE EXCEPTION 'Review source changed; save unreviewed inputs first' USING ERRCODE = 'PT409';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validate_workflow_version ON register.workflows;
CREATE TRIGGER validate_workflow_version BEFORE INSERT OR UPDATE ON register.workflows
  FOR EACH ROW EXECUTE FUNCTION register.validate_workflow_version();

CREATE OR REPLACE FUNCTION register.audit_workflow_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = register, pg_temp AS $$
BEGIN
  INSERT INTO register.workflow_revisions(owner_id, revision, document, schema_version, origin)
    VALUES (NEW.owner_id, NEW.revision, NEW.document, 1, 'workflow-save');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION register.validate_workflow_version() FROM PUBLIC;
REVOKE ALL ON FUNCTION register.audit_workflow_revision() FROM PUBLIC;
DROP TRIGGER IF EXISTS audit_workflow_revision ON register.workflows;
CREATE TRIGGER audit_workflow_revision AFTER INSERT OR UPDATE ON register.workflows
  FOR EACH ROW EXECUTE FUNCTION register.audit_workflow_revision();
NOTIFY pgrst, 'reload schema';
COMMIT;