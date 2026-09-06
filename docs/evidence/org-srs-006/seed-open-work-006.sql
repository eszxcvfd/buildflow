-- ORG-SRS-006 (#29) E2E seed + cleanup — demo open-work cho crew (tái sinh).
-- Prefix 'E2E6' để xóa sạch sau run (audit_logs append-only — KHÔNG xóa audit).
-- Tái sử dụng chuỗi project/area/work_type của seed ORG-SRS-004 (E2E4-PRJ còn trong DB).
-- Crew id chỉ có SAU khi tạo crew qua UI (S1) nên driver chèn assignment bằng crew id thật;
-- file này giữ work_order + template assignment để tái sinh thủ công.
--
-- Cách chạy work_order:
--   docker exec -i buildflow-postgres-1 psql -U buildflow -d buildflow < seed-open-work-006.sql
-- Assignment (thay <CREW_ID> bằng id crew E2E-CREW-01 vừa tạo):
--   INSERT INTO assignments (id, work_order_id, assignee_type, worker_id, crew_id,
--     responsible_user_id, source, status, requires_acceptance, assigned_by, assigned_at, created_at)
--   VALUES ('e2e6c100-0000-4000-8000-0000000000c2',
--     'e2e6b300-0000-4000-8000-0000000000b4', 'CREW', NULL, '<CREW_ID>',
--     '33333333-3333-4333-8333-333333333333', 'DIRECT_ASSIGNMENT', 'ACTIVE', false,
--     '22222222-2222-4222-8222-222222222222', now(), now());

-- Work order riêng cho crew (E2E4-WO-1 đã có assignment mở nên cần WO mới
-- vì ux_assignments_current cấm 2 assignment mở trên cùng work_order).
INSERT INTO work_orders (id, code, project_id, area_id, work_type_id, required_trade_id, title, description, instructions,
                         priority, status, planned_start_at, planned_end_at, due_at, progress_percent, job_board_open,
                         created_by, version, created_at, updated_at)
VALUES ('e2e6b300-0000-4000-8000-0000000000b4', 'E2E6-WO-1', 'e2e4b000-0000-4000-8000-0000000000b1',
        'e2e4b100-0000-4000-8000-0000000000b2', 'e2e4b200-0000-4000-8000-0000000000b3',
        '11111111-1111-4111-8111-111111111111', 'E2E6 Công việc mở cho đội', 'Công việc mở gán cho E2E-CREW-01',
        'Seed ORG-SRS-006', 'NORMAL', 'ASSIGNED',
        now(), now() + interval '14 days', now() + interval '20 days', 0, false,
        '22222222-2222-4222-8222-222222222222', 1, now(), now())
ON CONFLICT (id) DO NOTHING;

-- Xác nhận seed
SELECT 'work_order_E2E6' AS t, count(*) FROM work_orders WHERE id = 'e2e6b300-0000-4000-8000-0000000000b4';

-- ============ CLEANUP (chạy riêng SAU khi run E2E xong; audit_logs append-only — KHÔNG xóa) ============
-- DELETE FROM assignments WHERE id = 'e2e6c100-0000-4000-8000-0000000000c2';
-- DELETE FROM work_orders WHERE id = 'e2e6b300-0000-4000-8000-0000000000b4';
-- DELETE FROM crew_members WHERE crew_id IN (SELECT id FROM crews WHERE code IN ('E2E-CREW-01','E2E-CREW-DS'));
-- DELETE FROM crews WHERE code IN ('E2E-CREW-01','E2E-CREW-DS');
