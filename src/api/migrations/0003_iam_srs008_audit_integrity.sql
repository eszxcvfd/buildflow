-- IAM-SRS-008: audit log backend hardening — idempotent producers + append-only enforcement
--
-- (a) IDEMPOTENCY (AC: "Retry/duplicate event không nhân bản", "Mỗi event bắt buộc
--     tạo đúng một audit record"): một event mang correlation_id chỉ được ghi đúng
--     một lần cho mỗi cặp (correlation_id, action). Đây là partial unique index —
--     các event KHÔNG có correlation_id (best-effort, ví dụ AUTH_LOGIN_FAILED cho
--     user không tồn tại) không bị ràng buộc và luôn được ghi mới.
--
--     PgAuditRepository dùng INSERT ... ON CONFLICT (correlation_id, action)
--     WHERE correlation_id IS NOT NULL DO NOTHING khi correlation_id có mặt:
--     insert trùng là no-op (rowCount = 0) chứ KHÔNG phải lỗi, do đó:
--       * tx-embedded events (change-user-status, assign-roles): ghi trùng
--         (dedup) không abort business transaction; insert thất bại thật
--         (connection loss, CHECK/FK violation, ...) vẫn ném lỗi và abort
--         business write như thiết kế "audit failure = business failure".
--       * non-tx events (login/logout/password flows): dedup là kết quả bình
--         thường, không rơi vào nhánh retry.
--
--     LƯU Ý legacy data: nếu dữ liệu cũ đã chứa trùng (correlation_id, action),
--     việc tạo index sẽ thất bại. Migration này cố ý KHÔNG tự DELETE dữ liệu
--     (audit_logs là append-only); owner phải quyết định cleanup qua migration
--     riêng trước khi apply trên môi trường có dữ liệu trùng.
CREATE UNIQUE INDEX IF NOT EXISTS ux_audit_correlation_action
  ON public.audit_logs (correlation_id, action)
  WHERE correlation_id IS NOT NULL;

-- (b) APPEND-ONLY: audit_logs chỉ chấp nhận INSERT. Mọi UPDATE/DELETE (row-level)
--     và TRUNCATE (statement-level) bị chặn ở mức DB bằng trigger raise exception.
--     Retention/rotation phải là quyết định owner riêng (deferred — xem API.md);
--     khi được chốt, phải gỡ trigger qua migration mới, không thao tác thủ công.
CREATE OR REPLACE FUNCTION public.audit_logs_append_only_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
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
