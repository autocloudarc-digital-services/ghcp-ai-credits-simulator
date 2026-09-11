BEGIN;
SELECT pg_advisory_xact_lock(84017001);
SELECT 'CREATE ROLE application_sessions NOLOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'application_sessions') \gexec
GRANT application_sessions TO register_authenticator;
GRANT USAGE ON SCHEMA register TO application_sessions;
CREATE TABLE IF NOT EXISTS register.application_sessions (
  id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS application_sessions_expiry ON register.application_sessions(expires_at);
ALTER TABLE register.application_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_session ON register.application_sessions;
CREATE POLICY own_session ON register.application_sessions TO application_sessions
  USING (id = current_setting('request.jwt.claims', true)::jsonb->>'sub')
  WITH CHECK (id = current_setting('request.jwt.claims', true)::jsonb->>'sub');
GRANT SELECT, INSERT, UPDATE, DELETE ON register.application_sessions TO application_sessions;
CREATE OR REPLACE FUNCTION register.prune_application_sessions() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = register, pg_temp AS $$
  DELETE FROM register.application_sessions WHERE expires_at <= now();
$$;
REVOKE ALL ON FUNCTION register.prune_application_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register.prune_application_sessions() TO application_sessions;
COMMIT;