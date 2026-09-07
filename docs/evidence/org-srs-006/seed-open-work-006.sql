-- ORG-SRS-006 (#29) E2E seed + cleanup — demo open-work cho crew (tái sinh).
-- Theo docs/demo-data.md (chuẩn hóa 2026-09-07): WO realistic PRD-B1-006
-- 'Bảo trì thiết bị tầng hầm B1' trên chuỗi canonical PRD / B1-01 / BT-CT
-- (giữ UUID project/area/work_type). Tái dùng chuỗi này thay vì PRD-B1-001
-- vì ux_assignments_current cấm 2 assignment mở trên cùng work order.
-- Idempotent theo id (ON CONFLICT DO NOTHING). Cleanup id-based theo ids
-- (xem e2e-vars.json: woId/asnId/crewId/dsCrewId) + fallback mã run-pattern
-- DCD-*/DCT-* trong cửa sổ created_at (xem ORG-SRS-006-E2E.md §6).
-- audit_logs append-only — KHÔNG xóa audit.
-- Crew id chỉ có SAU khi tạo crew qua UI (S1) nên driver chèn assignment bằng crew id thật;
-- file này giữ work_order + template assignment để tái sinh thủ công.
--
-- Cách chạy work_order:
--   docker exec -i buildflow-postgres-1 psql -U buildflow -d buildflow < seed-open-work-006.sql
-- Assignment (thay <CREW_ID> bằng id crew DCD-* vừa tạo):
--   INSERT INTO assignments (id, work_order_id, assignee_type, worker_id, crew_id,
--     responsible_user_id, source, status, requires_acceptance, assigned_by, assigned_at, created_at)
--   VALUES ('e2e6c100-0000-4000-8000-0000000000c2',
--     'e2e6b300-0000-4000-8000-0000000000b4', 'CREW', NULL, '<CREW_ID>',
--     '33333333-3333-4333-8333-333333333333', 'DIRECT_ASSIGNMENT', 'ACTIVE', false,
--     '22222222-2222-4222-8222-222222222222', now(), now());

-- Work order riêng cho crew (PRD-B1-001 đã có assignment mở nên cần WO mới
-- vì ux_assignments_current cấm 2 assignment mở trên cùng work_order).
INSERT INTO work_orders (id, code, project_id, area_id, work_type_id, required_trade_id, title, description, instructions,
                         priority, status, planned_start_at, planned_end_at, due_at, progress_percent, job_board_open,
                         created_by, version, created_at, updated_at)
VALUES ('e2e6b300-0000-4000-8000-0000000000b4', 'PRD-B1-006', 'e2e4b000-0000-4000-8000-0000000000b1',
        'e2e4b100-0000-4000-8000-0000000000b2', 'e2e4b200-0000-4000-8000-0000000000b3',
        '11111111-1111-4111-8111-111111111111', 'Bảo trì thiết bị tầng hầm B1',
        'Công việc mở gán cho đội cơ điện (seed ORG-SRS-006)',
        'Kiểm tra tủ điện và hệ thống chiếu sáng tầng hầm B1 trước khi nghiệm thu', 'NORMAL', 'ASSIGNED',
        now(), now() + interval '14 days', now() + interval '20 days', 0, false,
        '22222222-2222-4222-8222-222222222222', 1, now(), now())
ON CONFLICT (id) DO NOTHING;

-- Xác nhận seed
SELECT 'work_order_PRD-B1-006' AS t, count(*) FROM work_orders WHERE id = 'e2e6b300-0000-4000-8000-0000000000b4';

-- ============ CLEANUP id-based (chạy SAU khi run E2E xong; audit_logs append-only — KHÔNG xóa) ============
-- DELETE FROM assignments WHERE id = 'e2e6c100-0000-4000-8000-0000000000c2';
-- DELETE FROM work_orders WHERE id = 'e2e6b300-0000-4000-8000-0000000000b4';
-- DELETE FROM crew_members WHERE crew_id IN (<crewId>, <dsCrewId>);
-- DELETE FROM crews WHERE id IN (<crewId>, <dsCrewId>);
-- -- fallback mã run-pattern trong cửa sổ 12h:
-- DELETE FROM crew_members WHERE crew_id IN (SELECT id FROM crews WHERE (code LIKE 'DCD-%' OR code LIKE 'DCT-%') AND created_at > now() - interval '12 hours');
-- DELETE FROM crews WHERE (code LIKE 'DCD-%' OR code LIKE 'DCT-%') AND created_at > now() - interval '12 hours';
