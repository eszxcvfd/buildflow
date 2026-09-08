-- PRJ-SRS-004 (issue #35) — work types catalog config columns.
--
-- Table `public.work_types` already exists in baseline 0001 (id uuid pk,
-- code, name, description, required_trade_id -> trades, default_duration_minutes,
-- default_priority, is_active default true, timestamps; unique `ux_work_types_code`;
-- index `ix_work_types_trade_active`; FK `work_types_required_trade_id_fkey`).
-- This migration only ADDS the slice columns; it creates NO new table and
-- alters NO existing FK/index/constraint.
--
-- 1. `work_type_group` text NULL — nhóm công việc (optional grouping label,
--    exposed as-is in the DTO; no separate CRUD).
-- 2. `required_fields` jsonb NOT NULL DEFAULT '[]' — danh sách dữ liệu bắt buộc
--    (`[{key,label,type,...}]`); entry shape is validated at the app layer
--    (entity/policy + repository guard), not by a DB CHECK, so future JOB/QUA
--    field kinds do not require a schema change.
-- 3. `config_version` integer NOT NULL DEFAULT 1 — version cấu hình cho
--    optimistic locking (`expectedConfigVersion` → 409 `WORK_TYPE_CONFIG_CONFLICT`)
--    và version snapshot cho JOB/QUA consumers (QUA-SRS-002). Existing rows keep
--    version 1 via the column default (no backfill needed).
ALTER TABLE public.work_types
  ADD COLUMN work_type_group text,
  ADD COLUMN required_fields jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN config_version integer NOT NULL DEFAULT 1;

-- Version is a monotonically increasing catalog counter (bumped by the app when
-- config-relevant fields change); the CHECK only guards manual writes.
ALTER TABLE public.work_types
  ADD CONSTRAINT work_types_config_version_ck CHECK (config_version >= 1);
