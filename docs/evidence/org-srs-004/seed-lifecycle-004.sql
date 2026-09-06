-- ORG-SRS-004 (#27) E2E seed — demo data tối thiểu (tái sinh + cleanup)
-- UUID prefix cố định 'E2E4' để xóa sạch sau run (trừ audit append-only).
-- Cách chạy: docker exec -i buildflow-postgres-1 psql -U buildflow -d buildflow < seed-lifecycle-004.sql

-- Người tạo dùng admin seed (11111111-1111-4111-8111-111111111111).
-- Nhà thầu E2E4-CONTRACTOR cho contractor lifecycle (không đụng NTA/HTB seed).
INSERT INTO contractors (id, code, name, contact_name, phone, email, status, note, created_by, created_at, updated_at)
VALUES ('e2e4c000-0000-4000-8000-0000000000c1', 'E2E4-CON', 'E2E4 Nhà thầu Lifecycle', 'E2E4 Contact',
        '0900123401', 'e2e4.con@example.com', 'ACTIVE', 'seed ORG-SRS-004', '11111111-1111-4111-8111-111111111111', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Worker E2E4 cho lifecycle (users.status ACTIVE, user_type WORKER, contractor gắn NTA seed
-- để cũng verify đếm open-work qua nhánh users.contractor_id nếu cần).
INSERT INTO users (id, email, password_hash, full_name, phone, avatar_url, employee_code, user_type,
                   contractor_id, status, failed_login_count, locked_until, last_login_at, created_by, created_at, updated_at)
VALUES ('e2e4a000-0000-4000-8000-0000000000a1', 'e2e4.worker@example.com', 'x-not-used-e2e4',
        'E2E4 Worker Lifecycle', '0900123402', NULL, 'E2E4WK001', 'WORKER',
        NULL, 'ACTIVE', 0, NULL, NULL, '11111111-1111-4111-8111-111111111111', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Công việc mở (open work) cho worker: cần work_order + area + project + work_type.
-- project: E2E4-PRJ (ACTIVE, owner admin); area: E2E4-AREA; work_type: E2E4-WT (trade THO-CAT).
INSERT INTO projects (id, code, name, description, address, planned_start_date, planned_end_date, manager_id, status, created_by, created_at, updated_at)
VALUES ('e2e4b000-0000-4000-8000-0000000000b1', 'E2E4-PRJ', 'E2E4 Project Lifecycle',
        'seed ORG-SRS-004', 'E2E4 Address', CURRENT_DATE, CURRENT_DATE + 90, '11111111-1111-4111-8111-111111111111',
        'ACTIVE', '11111111-1111-4111-8111-111111111111', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_areas (id, project_id, code, name, description, created_at, updated_at)
VALUES ('e2e4b100-0000-4000-8000-0000000000b2', 'e2e4b000-0000-4000-8000-0000000000b1', 'E2E4-AREA-1', 'E2E4 Khu vực 1', NULL, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO work_types (id, code, name, description, required_trade_id, default_duration_minutes, default_priority, is_active, created_at, updated_at)
VALUES ('e2e4b200-0000-4000-8000-0000000000b3', 'E2E4-WT', 'E2E4 Loại công việc', NULL, '11111111-1111-4111-8111-111111111111', 120, 'NORMAL', true, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO work_orders (id, code, project_id, area_id, work_type_id, required_trade_id, title, description, instructions,
                         priority, status, planned_start_at, planned_end_at, due_at, progress_percent, job_board_open,
                         created_by, version, created_at, updated_at)
VALUES ('e2e4b300-0000-4000-8000-0000000000b4', 'E2E4-WO-1', 'e2e4b000-0000-4000-8000-0000000000b1',
        'e2e4b100-0000-4000-8000-0000000000b2', 'e2e4b200-0000-4000-8000-0000000000b3',
        '11111111-1111-4111-8111-111111111111', 'E2E4 Công việc mở', 'Công việc mở cho E2E4 Worker',
        'Seed ORG-SRS-004', 'NORMAL', 'ASSIGNED',
        now(), now() + interval '14 days', now() + interval '20 days', 0, false,
        '11111111-1111-4111-8111-111111111111', 1, now(), now())
ON CONFLICT (id) DO NOTHING;

-- Assignment mở (PENDING_ACCEPTANCE) gán cho worker E2E4 — chính là nguồn countOpenAssignments=1.
INSERT INTO assignments (id, work_order_id, assignee_type, worker_id, crew_id, responsible_user_id, source, status,
                         requires_acceptance, assigned_by, assigned_at, responded_by, responded_at, response_reason,
                         ended_at, end_reason, created_at)
VALUES ('e2e4c100-0000-4000-8000-0000000000c2', 'e2e4b300-0000-4000-8000-0000000000b4', 'USER',
        'e2e4a000-0000-4000-8000-0000000000a1', NULL, 'e2e4a000-0000-4000-8000-0000000000a1',
        'DIRECT_ASSIGNMENT', 'PENDING_ACCEPTANCE', true,
        '11111111-1111-4111-8111-111111111111', now(), NULL, NULL, NULL, NULL, NULL, now())
ON CONFLICT (id) DO NOTHING;

-- Crew thuộc contractor E2E4-CON (nhánh crews.contractor_id của đếm contractor open-work).
INSERT INTO crews (id, code, name, contractor_id, description, status, created_by, created_at, updated_at)
VALUES ('e2e4c200-0000-4000-8000-0000000000c3', 'E2E4-CREW', 'E2E4 Crew', 'e2e4c000-0000-4000-8000-0000000000c1',
        NULL, 'ACTIVE', '11111111-1111-4111-8111-111111111111', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Xác nhận seed
SELECT 'contractor' AS t, count(*) FROM contractors WHERE id::text LIKE 'e2e4c000-%'
UNION ALL SELECT 'worker', count(*) FROM users WHERE id::text LIKE 'e2e4a000-%'
UNION ALL SELECT 'work_order', count(*) FROM work_orders WHERE id::text LIKE 'e2e4b300-%'
UNION ALL SELECT 'assignment', count(*) FROM assignments WHERE id::text LIKE 'e2e4c100-%'
UNION ALL SELECT 'crew', count(*) FROM crews WHERE id::text LIKE 'e2e4c200-%';

-- ============ CLEANUP (chạy riêng SAU khi run E2E xong; audit_logs append-only — KHÔNG xóa) ============
-- DELETE FROM assignments WHERE id::text LIKE 'e2e4c1%';
-- DELETE FROM crews       WHERE id::text LIKE 'e2e4c2%';
-- DELETE FROM work_orders WHERE id::text LIKE 'e2e4b3%';
-- DELETE FROM work_types  WHERE id::text LIKE 'e2e4b2%';
-- DELETE FROM project_areas WHERE id::text LIKE 'e2e4b1%';
-- DELETE FROM projects    WHERE id::text LIKE 'e2e4b0%';
-- DELETE FROM users       WHERE id::text LIKE 'e2e4a0%';
-- DELETE FROM contractors WHERE id::text LIKE 'e2e4c0%';
