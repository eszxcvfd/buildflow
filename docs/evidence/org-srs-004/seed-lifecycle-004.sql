-- ORG-SRS-004 (#27) E2E seed — demo data tối thiểu (tái sinh + cleanup)
-- UUID ổn định, trùng với dữ liệu demo realistic trong docs/demo-data.md
-- (chuẩn hóa realistic 2026-09-07: các row này là dữ liệu demo canonical —
--  contractor VCC, worker Đỗ Văn Cường, project PRD, work order PRD-B1-001...).
-- Idempotent: INSERT ... ON CONFLICT (id) DO NOTHING — chạy lại an toàn.
-- Cách chạy: docker exec -i buildflow-postgres-1 psql -U buildflow -d buildflow < seed-lifecycle-004.sql

-- Người tạo dùng admin seed (11111111-1111-4111-8111-111111111111).
-- Nhà thầu VCC (Công ty CP Xây dựng Vinacons) cho contractor lifecycle.
INSERT INTO contractors (id, code, name, contact_name, phone, email, status, note, created_by, created_at, updated_at)
VALUES ('e2e4c000-0000-4000-8000-0000000000c1', 'VCC', 'Công ty CP Xây dựng Vinacons', 'Trần Văn Thắng',
        '0900123401', 'lienhe@vinacons.vn', 'ACTIVE', 'Tổng thầu thi công kết cấu và hoàn thiện', '11111111-1111-4111-8111-111111111111', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Worker Đỗ Văn Cường (users.status INACTIVE theo canonical, driver tự đưa về ACTIVE lúc chạy).
INSERT INTO users (id, email, password_hash, full_name, phone, avatar_url, employee_code, user_type,
                   contractor_id, status, failed_login_count, locked_until, last_login_at, created_by, created_at, updated_at)
VALUES ('e2e4a000-0000-4000-8000-0000000000a1', 'cuong.do@vinacons.vn', 'x-not-used-e2e4',
        'Đỗ Văn Cường', '0900123402', NULL, 'TX-0021', 'WORKER',
        NULL, 'INACTIVE', 0, NULL, NULL, '11111111-1111-4111-8111-111111111111', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Công việc mở (open work) cho worker: cần work_order + area + project + work_type.
-- project: PRD Bệnh viện đa khoa Quận 7 (ACTIVE, owner admin); area: B1-01 Tầng hầm B1;
-- work_type: BT-CT Công tác bê tông cốt thép (trade THO-CAT).
INSERT INTO projects (id, code, name, description, address, planned_start_date, planned_end_date, manager_id, status, created_by, created_at, updated_at)
VALUES ('e2e4b000-0000-4000-8000-0000000000b1', 'PRD', 'Bệnh viện đa khoa Quận 7',
        'seed ORG-SRS-004', '31 Nguyễn Văn Linh, Q.7, TP.HCM', CURRENT_DATE, CURRENT_DATE + 90, '11111111-1111-4111-8111-111111111111',
        'ACTIVE', '11111111-1111-4111-8111-111111111111', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_areas (id, project_id, code, name, description, created_at, updated_at)
VALUES ('e2e4b100-0000-4000-8000-0000000000b2', 'e2e4b000-0000-4000-8000-0000000000b1', 'B1-01', 'Tầng hầm B1', NULL, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO work_types (id, code, name, description, required_trade_id, default_duration_minutes, default_priority, is_active, created_at, updated_at)
VALUES ('e2e4b200-0000-4000-8000-0000000000b3', 'BT-CT', 'Công tác bê tông cốt thép', NULL, '11111111-1111-4111-8111-111111111111', 120, 'NORMAL', true, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO work_orders (id, code, project_id, area_id, work_type_id, required_trade_id, title, description, instructions,
                         priority, status, planned_start_at, planned_end_at, due_at, progress_percent, job_board_open,
                         created_by, version, created_at, updated_at)
VALUES ('e2e4b300-0000-4000-8000-0000000000b4', 'PRD-B1-001', 'e2e4b000-0000-4000-8000-0000000000b1',
        'e2e4b100-0000-4000-8000-0000000000b2', 'e2e4b200-0000-4000-8000-0000000000b3',
        '11111111-1111-4111-8111-111111111111', 'Thi công sàn bê tông tầng hầm B1', 'Công việc mở cho Đỗ Văn Cường',
        'Seed ORG-SRS-004', 'NORMAL', 'ASSIGNED',
        now(), now() + interval '14 days', now() + interval '20 days', 0, false,
        '11111111-1111-4111-8111-111111111111', 1, now(), now())
ON CONFLICT (id) DO NOTHING;

-- Assignment mở (PENDING_ACCEPTANCE) gán cho worker — chính là nguồn countOpenAssignments=1.
INSERT INTO assignments (id, work_order_id, assignee_type, worker_id, crew_id, responsible_user_id, source, status,
                         requires_acceptance, assigned_by, assigned_at, responded_by, responded_at, response_reason,
                         ended_at, end_reason, created_at)
VALUES ('e2e4c100-0000-4000-8000-0000000000c2', 'e2e4b300-0000-4000-8000-0000000000b4', 'USER',
        'e2e4a000-0000-4000-8000-0000000000a1', NULL, 'e2e4a000-0000-4000-8000-0000000000a1',
        'DIRECT_ASSIGNMENT', 'PENDING_ACCEPTANCE', true,
        '11111111-1111-4111-8111-111111111111', now(), NULL, NULL, NULL, NULL, NULL, now())
ON CONFLICT (id) DO NOTHING;

-- Crew thuộc contractor VCC (nhánh crews.contractor_id của đếm contractor open-work).
INSERT INTO crews (id, code, name, contractor_id, description, status, created_by, created_at, updated_at)
VALUES ('e2e4c200-0000-4000-8000-0000000000c3', 'DD-CD', 'Đội cơ điện Vinacons', 'e2e4c000-0000-4000-8000-0000000000c1',
        NULL, 'ACTIVE', '11111111-1111-4111-8111-111111111111', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Xác nhận seed (theo id ổn định)
SELECT 'contractor' AS t, count(*) FROM contractors WHERE id = 'e2e4c000-0000-4000-8000-0000000000c1'
UNION ALL SELECT 'worker', count(*) FROM users WHERE id = 'e2e4a000-0000-4000-8000-0000000000a1'
UNION ALL SELECT 'work_order', count(*) FROM work_orders WHERE id = 'e2e4b300-0000-4000-8000-0000000000b4'
UNION ALL SELECT 'assignment', count(*) FROM assignments WHERE id = 'e2e4c100-0000-4000-8000-0000000000c2'
UNION ALL SELECT 'crew', count(*) FROM crews WHERE id = 'e2e4c200-0000-4000-8000-0000000000c3';

-- ============ CLEANUP (id-based; audit_logs append-only — KHÔNG xóa) ============
-- Các row seed là dữ liệu demo canonical (docs/demo-data.md) — KHÔNG xóa contractor/worker/
-- project/area/work_type/work_order/crew (xóa sẽ phá dữ liệu demo dùng chung).
-- Chỉ assignment mở là fixture thuần E2E: xóa theo id chính xác khi cần slate sạch,
-- rồi chạy lại seed để tái tạo (re-run đã kiểm chứng).
-- DELETE FROM assignments WHERE id = 'e2e4c100-0000-4000-8000-0000000000c2';
