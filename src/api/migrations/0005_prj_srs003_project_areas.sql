-- PRJ-SRS-003 (issue #34) — project areas (khu vuc/hang muc), single level.
--
-- Table `public.project_areas` already exists in baseline 0001 (id uuid pk,
-- project_id -> projects, code, name, is_active default true, timestamps).
-- This migration only adds the slice constraints; it creates NO new table.
--
-- Single-level enforcement is by schema: there is NO parent_id column at all,
-- so a second level cannot be represented. No DELETE endpoint exists; removal
-- is soft-retire (is_active=false) only. Hard delete stays forbidden after the
-- JOB (Work Order) module lands (see ENDPOINTS.md section 13, A2).
--
-- 1. Code becomes optional (nullable). Existing rows all carry a code, so no
--    backfill is needed. `ux_project_areas_project_code (project_id, code)`
--    keeps enforcing uniqueness for non-null codes (NULLs never conflict).
ALTER TABLE public.project_areas ALTER COLUMN code DROP NOT NULL;

-- 2. FK to projects as named RESTRICT (baseline auto-name
--    `project_areas_project_id_fkey`, NO ACTION semantics). Named constraint
--    so error mapping can match it before generic codes.
ALTER TABLE public.project_areas
  DROP CONSTRAINT IF EXISTS project_areas_project_id_fkey;
ALTER TABLE public.project_areas
  ADD CONSTRAINT fk_project_areas_project_id
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE RESTRICT;

-- 3. Name must be non-empty after trim (API also rejects before reaching DB).
ALTER TABLE public.project_areas
  ADD CONSTRAINT project_areas_name_ck CHECK (btrim(name) <> '');

-- 4. Active-name uniqueness per project (partial unique, same pattern as
--    `ux_project_members_active`). Inactive (retired) rows keep history and
--    never block a later reuse of the name.
--    Pre-flight (run BEFORE applying on DBs with legacy data; NOT executed
--    here — same role as the 0003 cleanup note in DATA.md): if any rows are
--    returned, resolve per owner decision before applying:
--      SELECT project_id, lower(name), count(*) FROM public.project_areas
--      WHERE is_active GROUP BY project_id, lower(name) HAVING count(*) > 1;
--    NOTE (superseded by 0006): this btree is case-sensitive; the expression
--    index `ux_project_areas_active_name_ci` in 0006 replaces it to enforce
--    the app's case-insensitive rule at DB level.
CREATE UNIQUE INDEX ux_project_areas_active_name
  ON public.project_areas (project_id, name) WHERE is_active;
