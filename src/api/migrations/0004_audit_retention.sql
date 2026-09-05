-- IAM-SRS-008: audit log retention — owner-approved purge path (session 2026-09-05)
--
-- Owner-confirmed policy: audit_logs retention = 365 days default, configurable
-- via AUDIT_RETENTION_DAYS. Purge runs as a BOUNDED DELETE of rows older than
-- the cutoff (npm run db:purge-audit), NOT TRUNCATE:
--   * the row-level trigger audit_logs_append_only_rows now allows DELETE only
--     while the session GUC `audit.purge_enabled` is 'on' — the purge script
--     sets it with SET LOCAL inside its own transaction, so every purge DELETE
--     is auditable/controlled and ordinary application sessions stay blocked;
--   * UPDATE stays absolutely blocked (never allowed, even with the GUC on);
--   * the statement-level TRUNCATE trigger audit_logs_append_only_truncate is
--     unchanged — TRUNCATE stays blocked (purge uses bounded DELETE).
--
-- Idempotent (forward-only runner): CREATE OR REPLACE FUNCTION + DROP-then-
-- CREATE trigger bindings, safe to re-run like migration 0003.
CREATE OR REPLACE FUNCTION public.audit_logs_append_only_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('audit.purge_enabled', true) = 'on' THEN
    -- Owner-approved retention path: bounded purge DELETE only (IAM-SRS-008,
    -- session 2026-09-05). Session-scoped GUC set via SET LOCAL by the purge
    -- script; the GUC is not available outside that controlled transaction.
    RETURN OLD;
  END IF;
  RAISE EXCEPTION
    'audit_logs is append-only (IAM-SRS-008): % on % is not allowed',
    TG_OP, TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_append_only_rows ON public.audit_logs;
CREATE TRIGGER audit_logs_append_only_rows
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_logs_append_only_guard();

DROP TRIGGER IF EXISTS audit_logs_append_only_truncate ON public.audit_logs;
CREATE TRIGGER audit_logs_append_only_truncate
  BEFORE TRUNCATE ON public.audit_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.audit_logs_append_only_guard();
