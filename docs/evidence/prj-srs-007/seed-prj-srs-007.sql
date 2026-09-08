-- Seed PRJ-SRS-007 (#38) — Vòng đời dữ liệu nền (areas).
-- Evidence-only, tái chạy an toàn (ON CONFLICT DO NOTHING). Không đụng dữ
-- liệu canonical (PRA/PRB/PRC/PRD, users TX-00xx). Cleanup theo id trong driver.
--
-- 1 dự án tiếng Việt + memberships tối thiểu:
--   P DA-PHUOC-LONG 'Khu dân cư Phước Long' (manager quoc.tran; thang.nguyen WORKER)
-- Areas / work-types / trades / crews / work_orders do driver tạo qua API + SQL
-- (để có audit rows + id runtime), cleanup theo id trong driver.

INSERT INTO projects (id, code, name, description, address, timezone,
                      planned_start_date, planned_end_date,
                      manager_id, status, created_by)
VALUES
  ('b7000001-0001-4000-8000-000000000001', 'DA-PHUOC-LONG', 'Khu dân cư Phước Long',
   'Khu dân cư thấp tầng ven rạch (đợt T9/2026)',
   'Phường Phước Long, TP Thủ Đức, TP Hồ Chí Minh', 'Asia/Ho_Chi_Minh',
   '2026-02-01', '2026-12-31',
   '22222222-2222-4222-8222-222222222222', 'ACTIVE',
   '11111111-1111-4111-8111-111111111111')
ON CONFLICT DO NOTHING;

-- Manager auto-membership (P9 mirror — seed thay cho POST /projects):
INSERT INTO project_members (id, project_id, user_id, project_role, is_active, added_by)
VALUES
  ('b7000001-0000-4000-8000-000000000010',
   'b7000001-0001-4000-8000-000000000001',
   '22222222-2222-4222-8222-222222222222', 'MANAGER', true,
   '11111111-1111-4111-8111-111111111111'),
  ('b7000001-0000-4000-8000-000000000011',
   'b7000001-0001-4000-8000-000000000001',
   '33333333-3333-4333-8333-333333333333', 'WORKER', true,
   '11111111-1111-4111-8111-111111111111')
ON CONFLICT DO NOTHING;
