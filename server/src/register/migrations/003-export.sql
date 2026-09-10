BEGIN;
SELECT pg_advisory_xact_lock(84017001);
CREATE OR REPLACE FUNCTION register.export_register()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, register AS $$
  SELECT jsonb_build_object(
    'exported_at', statement_timestamp(),
    'records', COALESCE((SELECT jsonb_agg(to_jsonb(record) ORDER BY record.id) FROM register.records record), '[]'::jsonb),
    'revisions', COALESCE((SELECT jsonb_agg(to_jsonb(history_row) ORDER BY history_row.record_id, history_row.revision) FROM register.revisions history_row), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION register.export_register() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register.export_register() TO register_api;
NOTIFY pgrst, 'reload schema';
COMMIT;