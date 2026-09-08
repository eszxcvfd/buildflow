-- JOB-SRS-001 (issue #41) — idempotency key cho tạo Work Order nháp.
--
-- Bảng `public.work_orders` đã có từ baseline 0001 (id uuid pk, code,
-- project_id → projects, area_id → project_areas, work_type_id → work_types,
-- required_trade_id → trades, title, description, instructions, priority,
-- status DEFAULT 'DRAFT', planned_start_at/planned_end_at, planned_headcount,
-- created_by → users, version DEFAULT 1, timestamps; unique
-- `ux_work_orders_code`; các index `ix_work_orders_*` giữ nguyên).
-- Slice này chỉ ADD một cột, không đổi FK/index/constraint hiện có.
--
-- 1. `request_key` uuid NULL — client-supplied idempotency key (optional).
--    POST /api/v1/work-orders gửi lại cùng `requestKey` trả về Work Order đã
--    tạo (`200 { ..., idempotentReplay: true }`), không ghi audit mới.
-- 2. Unique partial index `ux_work_orders_request_key (request_key)
--    WHERE request_key IS NOT NULL` — NULL không bao giờ match (nháp không
--    gửi key luôn insert mới); giá trị trùng → 23505 → app map về replay
--    (đọc lại row hiện có) thay vì 409.
--
-- Idempotent replay (NFR-REL-002): chạy lại file an toàn — `IF NOT EXISTS`
-- cho cả cột lẫn index (runner `scripts/migrate.js` cũng skip file đã apply
-- theo checksum, đây là guard tầng SQL cho replay thủ công).
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS request_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS ux_work_orders_request_key
  ON public.work_orders (request_key) WHERE request_key IS NOT NULL;
