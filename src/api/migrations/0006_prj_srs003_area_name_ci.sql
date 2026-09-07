-- PRJ-SRS-003 polish (issue #34, review P2-2) — case-insensitive active-name uniqueness.
--
-- 0005 created `ux_project_areas_active_name`, a partial btree on
-- (project_id, name) WHERE is_active. That index is case-sensitive, while the
-- app pre-check (`findActiveAreaByNameWithClient`, lower(name) = lower($2))
-- is case-insensitive (precedent P4 #32): two concurrent creates differing
-- only in case (e.g. `ABC`/`abc`) both passed the pre-check and the DB
-- accepted both — a case-race the DB did not close.
--
-- This migration replaces it with an expression unique index on
-- (project_id, lower(name)) WHERE is_active, so the DB enforces the same
-- case-insensitive rule the app pre-checks. Error mapping still matches by
-- constraint name (now `ux_project_areas_active_name_ci`) → 409 AREA_DUPLICATE.
--
-- Pre-flight (same role as the 0005 duplicate check below): if any rows are
-- returned, resolve per owner decision BEFORE applying (rename/retire the
-- legacy duplicates), mirroring the 0003 legacy-cleanup note in DATA.md:
--   SELECT project_id, lower(btrim(name)), count(*)
--   FROM public.project_areas WHERE is_active
--   GROUP BY project_id, lower(btrim(name)) HAVING count(*) > 1;
DROP INDEX IF EXISTS public.ux_project_areas_active_name;

CREATE UNIQUE INDEX ux_project_areas_active_name_ci
  ON public.project_areas (project_id, lower(name)) WHERE is_active;
