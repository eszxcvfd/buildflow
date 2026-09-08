-- PRJ-SRS-009 (issue #40) — attachments cơ bản (project scope; WO là extension
-- cùng bảng/cùng scope service).
--
-- Bảng `public.attachments` đã có từ baseline 0001 (id uuid pk, project_id →
-- projects, work_order_id → work_orders NULL, owner_type/owner_id,
-- attachment_type, uploaded_by → users, file_name, storage_key UNIQUE,
-- mime_type, size_bytes > 0, caption, created_at; các CHECK
-- `attachments_owner_type_ck`/`attachments_type_ck`/`attachments_size_ck` và
-- index `ux_attachments_storage_key`/`ix_attachments_*` giữ nguyên).
-- Slice này chỉ ADD cột + index, không đổi FK/index/constraint hiện có.
--
-- 1. `is_active` boolean NOT NULL DEFAULT true + `deactivated_at` timestamptz
--    NULL + `deactivated_by` uuid → users NULL + `deactivate_reason`
--    varchar(500) NULL — soft-retire (mirror revocation style
--    `project_members`: `project_members_revocation_ck CHECK (is_active OR
--    left_at IS NOT NULL)` → `attachments_revocation_ck CHECK (is_active OR
--    deactivated_at IS NOT NULL)`). Không xóa file vật lý khi retire —
--    history giữ (SRS PRJ-SRS-009 "ngừng sử dụng", không xóa cứng).
-- 2. `request_key` uuid NULL — client-supplied idempotency key cho upload
--    (mirror `work_orders.request_key` #41, migration 0009): replay cùng
--    `requestKey` trả về attachment HIỆN CÓ (`200 { ..., idempotentReplay:
--    true }`), KHÔNG ghi file mới, KHÔNG audit mới.
-- 3. Partial unique index `ux_attachments_request_key (request_key) WHERE
--    request_key IS NOT NULL` — NULL không bao giờ match (upload không gửi
--    key luôn insert mới); giá trị trùng → 23505 → app map về replay.
--
-- Idempotent replay: `IF NOT EXISTS` cho cột lẫn index (runner
-- `scripts/migrate.js` cũng skip file đã apply theo checksum — guard tầng SQL
-- cho replay thủ công).
ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deactivated_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS deactivate_reason varchar(500) NULL,
  ADD COLUMN IF NOT EXISTS request_key uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attachments_revocation_ck'
  ) THEN
    ALTER TABLE public.attachments
      ADD CONSTRAINT attachments_revocation_ck CHECK (is_active OR deactivated_at IS NOT NULL);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_attachments_request_key
  ON public.attachments (request_key) WHERE request_key IS NOT NULL;
