-- JOB publish-check custom fields (issue #42 follow-up) — nơi lưu giá trị
-- `required_fields` tùy chỉnh của loại công việc.
--
-- Bối cảnh: `work_types.required_fields` cho phép key tùy chỉnh (thí dụ
-- `dien_tich`, `anh_nghiem_thu` của `WT-OP-LAT`) nhưng `public.work_orders`
-- không có cột tương ứng, nên `MISSING_REQUIRED_FIELD` fail-closed không bao
-- giờ pass được. Slice này chỉ ADD một cột, không đổi FK/index/constraint
-- hiện có.
--
-- 1. `custom_fields` jsonb NOT NULL DEFAULT '{}' — object phẳng
--    `{ key: string | number | boolean }` (shape + giới hạn size/depth do app
--    layer validate — `normalizeCustomFieldsInput` trong
--    `work-order.policy.ts` — không DB CHECK chi tiết để JOB thêm field kind
--    không cần đổi schema, mirror `work_types.required_fields` #35).
-- 2. `work_orders_custom_fields_ck CHECK (jsonb_typeof(custom_fields) = 'object')`
--    — guard nhẹ tầng DB: luôn là object (không bao giờ là array/scalar),
--    merge partial ở app layer (`PATCH customFields`) không bao giờ phá shape.
--
-- Idempotent replay (NFR-REL-002): `IF NOT EXISTS` cho cột; constraint guard
-- bằng `DO` block kiểm tra `pg_constraint` (PostgreSQL không hỗ trợ
-- `ADD CONSTRAINT IF NOT EXISTS`). Runner `scripts/migrate.js` cũng skip file
-- đã apply theo checksum — đây là guard tầng SQL cho replay thủ công.
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_custom_fields_ck'
  ) THEN
    ALTER TABLE public.work_orders
      ADD CONSTRAINT work_orders_custom_fields_ck CHECK (jsonb_typeof(custom_fields) = 'object');
  END IF;
END
$$;
