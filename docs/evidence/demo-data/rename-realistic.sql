-- ============================================================================
-- BuildFlow demo-data overhaul, step 1 (2026-09-07): rename E2E/probe/test
-- fixture data to realistic Vietnamese construction-domain data.
--
-- Fiction: Công ty CP Xây dựng Vinacons (VINACONS), email @vinacons.vn.
--
-- HOW TO APPLY (live DB):
--   docker exec -i buildflow-postgres-1 psql -U buildflow -d buildflow \
--     < docs/evidence/demo-data/rename-realistic.sql
--
-- IDEMPOTENT: every statement is safe to re-run (updates keyed by stable
-- UUID, inserts guarded by ON CONFLICT DO NOTHING, deletes by exact code).
--
-- HARD CONSTRAINTS (must keep holding):
--   * audit_logs is APPEND-ONLY (DB trigger blocks UPDATE/DELETE/TRUNCATE).
--     This script NEVER touches audit_logs: historical audit rows keep the
--     old e2e identifiers ON PURPOSE (đổi tên 2026-09-07, dữ liệu cũ còn
--     trong audit_logs (append-only) là có chủ ý).
--   * schema_migrations untouched.
--   * All UUIDs, roles (user_roles), user status (incl. INACTIVE),
--     password hashes and project planned dates UNCHANGED.
--   * Only UPDATE-in-place, INSERT of new rows, DELETE of unreferenced
--     leftovers. All writes are direct SQL, so no application audit rows
--     are generated.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. users: realistic emails / full names / employee codes / phones.
--    Passwords UNCHANGED. Status UNCHANGED (incl. cuong.do INACTIVE).
--    UUIDs used as keys so re-runs are no-ops.
-- --------------------------------------------------------------------------
UPDATE users SET email = 'hoang.anh@vinacons.vn', full_name = 'Nguyễn Hoàng Anh', phone = '0901234561'
 WHERE id = '11111111-1111-4111-8111-111111111111'; -- ex admin@example.com (ADMIN+STAFF)

UPDATE users SET email = 'quoc.tran@vinacons.vn', full_name = 'Trần Quốc Điều', phone = '0912345672'
 WHERE id = '22222222-2222-4222-8222-222222222222'; -- ex pm@example.com (name unchanged)

UPDATE users SET email = 'thang.nguyen@vinacons.vn', full_name = 'Nguyễn Văn Thắng', employee_code = 'TX-0010', phone = '0932345673'
 WHERE id = '33333333-3333-4333-8333-333333333333'; -- ex worker1@example.com

UPDATE users SET email = 'hau.le@vinacons.vn', full_name = 'Lê Văn Hậu', employee_code = 'TX-0011', phone = '0903456784'
 WHERE id = '44444444-4444-4444-8444-444444444444'; -- ex worker2@example.com

UPDATE users SET email = 'tuan.pham@vinacons.vn', full_name = 'Phạm Văn Tuấn', employee_code = 'TX-0012'
 WHERE id = '7fd29069-bdfa-4e20-a8a7-41a11f7c4b68'; -- ex e2e.t.onzfuf@example.com (keeps phone 0909211361)

UPDATE users SET email = 'dong.trinh@vinacons.vn', full_name = 'Trịnh Văn Đông', employee_code = 'TX-0018'
 WHERE id = 'a2e62200-0305-4d33-a553-4f200859423e'; -- ex e2e.t.oo1cby@example.com (keeps phone 0909813672)

UPDATE users SET email = 'cuong.do@vinacons.vn', full_name = 'Đỗ Văn Cường', employee_code = 'TX-0021'
 WHERE id = 'e2e4a000-0000-4000-8000-0000000000a1'; -- ex e2e4.worker@example.com (stays INACTIVE, keeps phone 0900123402)

UPDATE users SET email = 'ba.nguyen@vinacons.vn', full_name = 'Nguyễn Văn Ba', employee_code = 'TX-0015', phone = '0914567895'
 WHERE id = '98230b1d-f254-4e99-9515-f9e2b1fd63a4'; -- ex e2e5.worker3@example.com

-- --------------------------------------------------------------------------
-- 2. projects: E2E4-PRJ -> PRD 'Bệnh viện đa khoa Quận 7'.
--    Status / planned dates / manager UNCHANGED. PRA/PRB/PRC untouched.
-- --------------------------------------------------------------------------
UPDATE projects
   SET code = 'PRD',
       name = 'Bệnh viện đa khoa Quận 7',
       address = '31 Nguyễn Văn Linh, Q.7, TP.HCM'
 WHERE id = 'e2e4b000-0000-4000-8000-0000000000b1';

-- --------------------------------------------------------------------------
-- 3. contractors: E2E4-CON -> VCC 'Công ty CP Xây dựng Vinacons'.
--    NTA/HTB untouched; total row count stays 3.
-- --------------------------------------------------------------------------
UPDATE contractors
   SET code = 'VCC',
       name = 'Công ty CP Xây dựng Vinacons'
 WHERE id = 'e2e4c000-0000-4000-8000-0000000000c1';

-- --------------------------------------------------------------------------
-- 4. trades: rename 3 E2E rows in place; THO-CAT kept as-is.
-- --------------------------------------------------------------------------
UPDATE trades SET code = 'OP-LAT',   name = 'Thợ ốp lát'   WHERE id = 'b017178a-daf2-4614-ac34-a05e1d1a6fb7'; -- ex E2E-TONWFWD
UPDATE trades SET code = 'SON-NUOC', name = 'Thợ sơn nước' WHERE id = 'e8f974e9-3d12-4f25-97cb-32bd81b843fd'; -- ex E2E-TONZFUF
UPDATE trades SET code = 'DIEN',     name = 'Thợ điện'     WHERE id = '85fc5da0-cb00-4650-9e3c-fae7a83ab656'; -- ex E2E-TOO1CBY

-- DUP rows verified unreferenced on 2026-09-07
-- (0 rows in resource_trades + work_orders + work_types each) -> DELETE.
DELETE FROM trades WHERE code IN ('E2E-DUP-ONWFWD', 'E2E-DUP-ONZFUF', 'E2E-DUP-OO1CBY');

-- --------------------------------------------------------------------------
-- 5. resource_trades: dedupe to one row per (user_id, trade_id).
--    Legacy seed created an active + inactive pair per mapping; the
--    inactive leftovers (blocked from the partial unique index only
--    because is_active = false) are removed.
-- --------------------------------------------------------------------------
DELETE FROM resource_trades rt_inactive
 USING resource_trades rt_active
 WHERE rt_inactive.is_active = false
   AND rt_active.is_active = true
   AND rt_inactive.user_id = rt_active.user_id
   AND rt_inactive.trade_id = rt_active.trade_id;

-- --------------------------------------------------------------------------
-- 6. crews: E2E4-CREW -> DD-CD 'Đội cơ điện Vinacons', linked to VCC.
-- --------------------------------------------------------------------------
UPDATE crews
   SET code = 'DD-CD',
       name = 'Đội cơ điện Vinacons',
       contractor_id = (SELECT id FROM contractors WHERE code = 'VCC')
 WHERE id = 'e2e4c200-0000-4000-8000-0000000000c3';

-- --------------------------------------------------------------------------
-- 7. work_types: E2E4-WT -> BT-CT 'Công tác bê tông cốt thép'.
-- --------------------------------------------------------------------------
UPDATE work_types
   SET code = 'BT-CT',
       name = 'Công tác bê tông cốt thép',
       description = 'Cốp pha, cốt thép, đổ và bảo dưỡng bê tông'
 WHERE id = 'e2e4b200-0000-4000-8000-0000000000b3';

-- --------------------------------------------------------------------------
-- 8. project_areas: rename E2E4-AREA-1 -> B1-01 'Tầng hầm B1';
--    insert realistic extra areas (idempotent via unique constraints).
-- --------------------------------------------------------------------------
UPDATE project_areas
   SET code = 'B1-01', name = 'Tầng hầm B1', display_order = 1
 WHERE id = 'e2e4b100-0000-4000-8000-0000000000b2';

INSERT INTO project_areas (project_id, code, name, display_order, is_active) VALUES
  ('10000000-0000-4000-8000-000000000001', 'KQ-01',  'Sảnh chính - Tầng 1',        1, true), -- PRA
  ('10000000-0000-4000-8000-000000000001', 'TM-02',  'Khu thương mại - Tầng 2',    2, true), -- PRA
  ('10000000-0000-4000-8000-000000000002', 'GA-A03', 'Block A - Tầng 3',           1, true), -- PRB
  ('e2e4b000-0000-4000-8000-0000000000b1', 'PT-04',  'Khu phẫu thuật - Tầng 4',    2, true), -- PRD
  ('e2e4b000-0000-4000-8000-0000000000b1', 'CC-02',  'Khu khám chữa bệnh - Tầng 2', 3, true)  -- PRD
ON CONFLICT (project_id, code) DO NOTHING;

-- --------------------------------------------------------------------------
-- 9. project_members: realistic seed (was empty). Direct SQL -> no audit rows.
--    added_by = admin (hoang.anh@vinacons.vn). Idempotent via partial
--    unique index ux_project_members_active (project_id, user_id) WHERE is_active.
-- --------------------------------------------------------------------------
INSERT INTO project_members (project_id, user_id, project_role, is_active, added_by) VALUES
  -- pm quoc.tran MANAGER on all four projects
  ('10000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'MANAGER',     true, '11111111-1111-4111-8111-111111111111'), -- PRA
  ('10000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'MANAGER',     true, '11111111-1111-4111-8111-111111111111'), -- PRB
  ('10000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'MANAGER',     true, '11111111-1111-4111-8111-111111111111'), -- PRC
  ('e2e4b000-0000-4000-8000-0000000000b1', '22222222-2222-4222-8222-222222222222', 'MANAGER',     true, '11111111-1111-4111-8111-111111111111'), -- PRD
  -- site team
  ('10000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 'WORKER',      true, '11111111-1111-4111-8111-111111111111'), -- hau.le on PRA
  ('10000000-0000-4000-8000-000000000001', '98230b1d-f254-4e99-9515-f9e2b1fd63a4', 'QC',          true, '11111111-1111-4111-8111-111111111111'), -- ba.nguyen on PRA
  ('10000000-0000-4000-8000-000000000002', '7fd29069-bdfa-4e20-a8a7-41a11f7c4b68', 'WORKER',      true, '11111111-1111-4111-8111-111111111111'), -- tuan.pham on PRB
  ('e2e4b000-0000-4000-8000-0000000000b1', '33333333-3333-4333-8333-333333333333', 'WORKER',      true, '11111111-1111-4111-8111-111111111111'), -- thang.nguyen on PRD
  ('e2e4b000-0000-4000-8000-0000000000b1', 'a2e62200-0305-4d33-a553-4f200859423e', 'COORDINATOR', true, '11111111-1111-4111-8111-111111111111')  -- dong.trinh on PRD
ON CONFLICT (project_id, user_id) WHERE is_active DO NOTHING;

-- --------------------------------------------------------------------------
-- 10. work_orders: E2E4-WO-1 -> realistic hospital-basement concreting order.
--     Assignment rows untouched.
-- --------------------------------------------------------------------------
UPDATE work_orders
   SET code = 'PRD-B1-001',
       title = 'Thi công sàn bê tông tầng hầm B1',
       description = 'Thi công sàn bê tông cốt thép tầng hầm B1, dự án Bệnh viện đa khoa Quận 7',
       instructions = 'Tuân thủ bản vẽ KC-B1 và biện pháp thi công đã duyệt; nghiệm thu cốp pha, cốt thép trước khi đổ bê tông'
 WHERE id = 'e2e4b300-0000-4000-8000-0000000000b4';

-- --------------------------------------------------------------------------
-- 11. final sweep 2026-09-08: runtime trades leftover from org-srs-003
--     evidence runs (uniq-suffix codes, never canonical). Verified 0 refs in
--     resource_trades + work_orders.required_trade_id +
--     work_types.required_trade_id on 2026-09-08 -> DELETE (idempotent).
-- --------------------------------------------------------------------------
DELETE FROM trades WHERE code IN ('NK-R5S2B7', 'XT-R5S2B7');

COMMIT;

-- --------------------------------------------------------------------------
-- Verification (run after apply; expect 0 rows each):
--   SELECT email FROM users            WHERE email ~* 'e2e|probe|test';
--   SELECT code, name FROM projects    WHERE code ~* 'e2e|probe|test' OR name ~* 'e2e|probe|test';
--   SELECT code, name FROM trades      WHERE code ~* 'e2e|probe|test' OR name ~* 'e2e|probe|test';
--   SELECT code, name FROM contractors WHERE code ~* 'e2e|probe|test' OR name ~* 'e2e|probe|test';
--   SELECT code, name FROM crews       WHERE code ~* 'e2e|probe|test' OR name ~* 'e2e|probe|test';
--   SELECT code FROM work_types        WHERE code ~* 'e2e|probe|test';
--   SELECT code, title FROM work_orders WHERE code ~* 'e2e|probe|test' OR title ~* 'e2e|probe|test';
--   SELECT a.code, a.name FROM project_areas a
--     WHERE a.code ~* 'e2e|probe|test' OR a.name ~* 'e2e|probe|test';
-- NOTE: audit_logs is intentionally NOT covered — old identifiers remain there.
-- --------------------------------------------------------------------------
