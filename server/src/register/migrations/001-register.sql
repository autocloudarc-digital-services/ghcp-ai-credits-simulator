\getenv register_password REGISTER_AUTHENTICATOR_PASSWORD
BEGIN;
SELECT pg_advisory_xact_lock(84017001);
SELECT 'CREATE ROLE register_authenticator NOINHERIT LOGIN'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'register_authenticator') \gexec
ALTER ROLE register_authenticator PASSWORD :'register_password';
SELECT 'CREATE ROLE register_api NOLOGIN'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'register_api') \gexec
GRANT register_api TO register_authenticator;
CREATE SCHEMA IF NOT EXISTS register;
REVOKE ALL ON SCHEMA register FROM PUBLIC;
GRANT USAGE ON SCHEMA register TO register_api;
CREATE TABLE IF NOT EXISTS register.records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  document jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(document) = 'object'),
  CHECK (document->>'record_type' IN ('policy-profile','ULB','entitlement-baseline',
    'included-usage-control','metered-budget','license-baseline','rollout-wave','controlled-test','exception')),
  CHECK (length(document->>'scope_id') > 0),
  CHECK (length(document->>'enterprise_control_id') > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS register_logical_key ON register.records (
  tenant_id, (document->>'record_type'), (document->>'scope_id'),
  (document->>'enterprise_control_id'), (COALESCE(document->>'policy_or_profile','not-applicable')),
  (COALESCE(document->>'profile_version','0'))
);
CREATE TABLE IF NOT EXISTS register.revisions (
  record_id uuid NOT NULL REFERENCES register.records(id),
  tenant_id text NOT NULL,
  revision integer NOT NULL,
  document jsonb NOT NULL,
  actor_id text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (record_id, revision)
);
ALTER TABLE register.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE register.revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_records ON register.records;
CREATE POLICY tenant_records ON register.records FOR SELECT TO register_api
  USING (tenant_id = current_setting('request.jwt.claims',true)::jsonb->>'tenant');
DROP POLICY IF EXISTS tenant_revisions ON register.revisions;
CREATE POLICY tenant_revisions ON register.revisions FOR SELECT TO register_api
  USING (tenant_id = current_setting('request.jwt.claims',true)::jsonb->>'tenant');
GRANT SELECT ON register.records, register.revisions TO register_api;
REVOKE INSERT, UPDATE, DELETE ON register.records, register.revisions FROM register_api;
COMMIT;