-- Seed PRJ-SRS-006 (#37) — Kiểm soát truy cập dự án.
-- Evidence-only, tái chạy an toàn (ON CONFLICT DO NOTHING). Không đụng dữ
-- liệu canonical (PRA/PRB/PRC/PRD, users TX-00xx). Cleanup theo id trong driver.
--
-- 2 dự án tiếng Việt + memberships đa dạng:
--   A DA-AN-PHU  'Khu dân cư An Phú'   (manager quoc.tran;
--      thang.nguyen WORKER, dong.trinh COORDINATOR)
--   B DA-SONG-HONG 'Chung cư Sông Hồng' (manager quoc.tran;
--      hau.le WORKER, ba.nguyen VIEWER)
-- thang.nguyen ∈ A, ∉ B (tampering target); hau.le ∈ B, ∉ A (chiều ngược).

INSERT INTO projects (id, code, name, description, address, timezone,
                      planned_start_date, planned_end_date,
                      manager_id, status, created_by)
VALUES
  ('b60000a1-0001-4000-8000-000000000001', 'DA-AN-PHU', 'Khu dân cư An Phú',
   'Khu dân cư thấp tầng giai đoạn 1 (đợt T9/2026)',
   'Phường An Phú, TP Thủ Đức, TP Hồ Chí Minh', 'Asia/Ho_Chi_Minh',
   '2026-01-05', '2026-12-20',
   '22222222-2222-4222-8222-222222222222', 'ACTIVE',
   '11111111-1111-4111-8111-111111111111'),
  ('b60000b2-0002-4000-8000-000000000002', 'DA-SONG-HONG', 'Chung cư Sông Hồng',
   'Chung cư cao tầng bên sông (đợt T9/2026)',
   'Phường Phú Thuận, Quận 7, TP Hồ Chí Minh', 'Asia/Ho_Chi_Minh',
   '2026-03-01', '2027-02-28',
   '22222222-2222-4222-8222-222222222222', 'ACTIVE',
   '11111111-1111-4111-8111-111111111111')
ON CONFLICT DO NOTHING;

-- Manager auto-membership (P9 mirror — seed thay cho POST /projects):
INSERT INTO project_members (id, project_id, user_id, project_role, is_active, added_by)
VALUES
  ('b60000a1-0000-4000-8000-0000000000a0',
   'b60000a1-0001-4000-8000-000000000001',
   '22222222-2222-4222-8222-222222222222', 'MANAGER', true,
   '11111111-1111-4111-8111-111111111111'),
  ('b60000b2-0000-4000-8000-0000000000b0',
   'b60000b2-0002-4000-8000-000000000002',
   '22222222-2222-4222-8222-222222222222', 'MANAGER', true,
   '11111111-1111-4111-8111-111111111111')
ON CONFLICT DO NOTHING;

INSERT INTO project_members (id, project_id, user_id, project_role, is_active, added_by)
VALUES
  ('b60000a1-1001-4000-8000-000000000001',
   'b60000a1-0001-4000-8000-000000000001',
   '33333333-3333-4333-8333-333333333333', 'WORKER', true,
   '11111111-1111-4111-8111-111111111111'),
  ('b60000a1-1002-4000-8000-000000000002',
   'b60000a1-0001-4000-8000-000000000001',
   'a2e62200-0305-4d33-a553-4f200859423e', 'COORDINATOR', true,
   '11111111-1111-4111-8111-111111111111'),
  ('b60000b2-1001-4000-8000-000000000003',
   'b60000b2-0002-4000-8000-000000000002',
   '44444444-4444-4444-8444-444444444444', 'WORKER', true,
   '11111111-1111-4111-8111-111111111111'),
  ('b60000b2-1002-4000-8000-000000000004',
   'b60000b2-0002-4000-8000-000000000002',
   '98230b1d-f254-4e99-9515-f9e2b1fd63a4', 'VIEWER', true,
   '11111111-1111-4111-8111-111111111111')
ON CONFLICT DO NOTHING;
