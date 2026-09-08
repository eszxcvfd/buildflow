-- PRJ-SRS-008 (issue #39) — work order templates catalog.
--
-- Table `public.work_order_templates` is NEW (no prior baseline coverage).
-- Snapshot-copy semantics (SRS: sửa mẫu không hồi tố Work Order đã tạo):
-- templates carry denormalized `required_skills` / `checklist_snapshot`
-- jsonb; there is deliberately NO FK from `work_orders` to this table and
-- no `template_id` column on `work_orders` (JOB-SRS-001 prefill will copy
-- values via GET /active + GET /:id — see ENDPOINTS.md §16).
--
-- Columns:
-- 1. `code` / `name` / `description` — template identity (mirror work_types).
-- 2. `work_type_id` uuid NULL REFERENCES work_types — optional link; when
--    sent must reference an ACTIVE work type (app-layer check).
-- 3. `required_trade_id` uuid NULL REFERENCES trades — optional skill scope
--    (mirror work_types.required_trade_id).
-- 4. `default_duration_minutes` / `default_priority` — prefill defaults.
-- 5. `required_skills` jsonb NOT NULL DEFAULT '[]' — `[{code,label}]` where
--    `code` is a trade code; existence + active enforced at app layer
--    (policy + repo lookup on public.trades), not by DB CHECK, so future
--    skill kinds do not require a schema change (mirror required_fields #35).
-- 6. `checklist_snapshot` jsonb NOT NULL DEFAULT '[]' —
--    `[{title,answerType,isRequired,isBlocking,requiresPhoto?,sequenceNo}]`;
--    shape validated at app layer (mirror required_fields #35). Seeded from
--    `source_checklist_template_id` items on create when the caller omits
--    an explicit snapshot.
-- 7. `source_checklist_template_id` uuid NULL REFERENCES
--    checklist_templates — provenance only, never a live link.
-- 8. `status` varchar(15) DEFAULT 'DRAFT' — DRAFT|ACTIVE|INACTIVE lifecycle
--    (DRAFT --ACTIVATE--> ACTIVE --DEACTIVATE--> INACTIVE --ACTIVATE--> ACTIVE).
-- 9. `version` integer DEFAULT 1 — config version for optimistic locking
--    (`expectedVersion` → 409) and JOB prefill snapshot consumers.
CREATE TABLE public.work_order_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL,
  name varchar(150) NOT NULL,
  description varchar(500),
  work_type_id uuid REFERENCES public.work_types(id),
  required_trade_id uuid REFERENCES public.trades(id),
  default_duration_minutes integer,
  default_priority varchar(10) NOT NULL DEFAULT 'NORMAL',
  required_skills jsonb NOT NULL DEFAULT '[]',
  checklist_snapshot jsonb NOT NULL DEFAULT '[]',
  source_checklist_template_id uuid REFERENCES public.checklist_templates(id),
  status varchar(15) NOT NULL DEFAULT 'DRAFT',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT work_order_templates_status_ck CHECK (
    status IN ('DRAFT', 'ACTIVE', 'INACTIVE')
  ),
  CONSTRAINT work_order_templates_version_ck CHECK (version >= 1),
  CONSTRAINT work_order_templates_duration_ck CHECK (
    default_duration_minutes IS NULL OR default_duration_minutes > 0
  ),
  CONSTRAINT work_order_templates_priority_ck CHECK (
    default_priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')
  )
);

-- Code uniqueness: plain btree (case-sensitive) + app-layer case-insensitive
-- pre-check (`lower(code)`), same residual as work_types W2: two concurrent
-- creates differing only in case may both pass the DB; sequential behavior
-- is CI-unique via the 409 pre-check.
CREATE UNIQUE INDEX ux_work_order_templates_code ON public.work_order_templates (code);

-- Picker + list filter path (`WHERE work_type_id = $ AND status = $`).
CREATE INDEX ix_work_order_templates_type_status
  ON public.work_order_templates (work_type_id, status);
