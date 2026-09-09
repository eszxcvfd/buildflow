-- Seed realistic operations — plan v2 T2 (2026-09-09).
--
-- Fiction: Công ty CP Xây dựng Vinacons (@vinacons.vn), tiếng Việt có dấu.
-- Mật khẩu seed users: `Vinacons@2026` (bcrypt cost 10 qua crypt/gen_salt —
-- user MỚI nên hash mới là hợp lệ; KHÔNG đổi hash user hiện hữu).
--
-- Quy ước ID: dec0de00-0000-4000-8000-0000000000<SUFFIX> (hex 01..97), cố định
-- để idempotent qua INSERT ... ON CONFLICT DO NOTHING (chạy lại = no-op).
-- Một BEGIN/COMMIT; thứ tự theo FK graph: contractors → users → trades →
-- user_roles → crews → crew_members → resource_trades → projects →
-- project_areas → project_members → work_orders → dependencies → assignments →
-- state_history → work_order_updates → materials → work_order_materials →
-- readiness checks + items → blockers → material_supplement_requests →
-- checklist_templates + items → inspection checkpoint templates + checkpoints →
-- checklist_instances + items → inspections → corrective_actions → attachments →
-- notifications.
-- Chu kỳ FK contractors↔users: contractor mới chèn TRƯỚC với
-- created_by = hoang.anh (11111111-1111-4111-8111-111111111111) hiện hữu.
--
-- Né va chạm driver (T3/T4 để sau — không đụng driver):
--   * Mọi WO seed có job_board_open = false (board ĐÓNG) và nằm ở PRD + project
--     mới PRT (KHÔNG ở PRA/PRB) → driver-005 S2 (worker ba.nguyen chỉ thấy AVAIL
--     driver tự tạo) và S5 (total giảm đúng 1: before/after cùng baseline, seed
--     vô hình với board) không bị ảnh hưởng; cleanup S7 rest=0 theo id driver.
--   * Fixtures driver-005/004 giữ nguyên: PRA/PRB, KQ-01 (589c0681-...),
--     GA-A03 (07fe0492-...), BT-CT (e2e4b200-...), THO-CAT (11111111-...),
--     cuong.do SEED_WORKER_ID (e2e4a000-...) INACTIVE — script này không đụng.
--   * ux_assignments_current: mỗi WO seed tối đa 1 assignment PENDING/ACTIVE
--     (WOs 27/28/24); WO PRD-B1-001 của driver-giữ không đụng.
--   * ux_crew_one_active_lead: mỗi crew mới đúng 1 LEAD active.
--   * ux_project_areas_active_name_ci: tên area mới duy nhất trong từng project.
--   * MSR blocker CHECK: is_blocking=true chỉ khi có blocker_id (MSR-001).
--   * corrective assignee USER xor CREW đúng từng dòng.
--
-- Ngoại lệ <5 (KHÔNG ép vô nghĩa — chi tiết ở báo cáo + docs/demo-data.md §6):
--   roles, password_reset_tokens, schema_migrations (xem guard cuối).

BEGIN;

-- ── contractors (mới; created_by = hoang.anh phá chu kỳ FK) ──────────────
INSERT INTO contractors (id, code, name, contact_name, phone, email, status, note, created_by)
VALUES
 ('dec0de00-0000-4000-8000-000000000001', 'XD-TH', N'Công ty TNHH Xây dựng Trường Hải', N'Trần Văn Hải', '02838123456', 'lienhe@truonghai-xd.vn', 'ACTIVE', N'Thầu phụ phần thô khu Thủ Thiêm', '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-000000000002', 'CD-VT', N'Công ty CP Cơ điện Việt Thắng', N'Lê Minh Thắng', '02838234567', 'info@vietthang-ce.vn', 'ACTIVE', N'Thầu phụ cơ điện', '11111111-1111-4111-8111-111111111111')
ON CONFLICT DO NOTHING;

-- ── users mới (bcrypt cost 10 tự tạo; created_by = hoang.anh) ────────────
INSERT INTO users (id, email, password_hash, full_name, phone, employee_code, user_type, contractor_id, status, created_by)
VALUES
 ('dec0de00-0000-4000-8000-000000000003', 'son.nguyen@vinacons.vn', crypt('Vinacons@2026', gen_salt('bf', 10)), N'Nguyễn Văn Sơn', '0903344551', 'TX-0030', 'STAFF', NULL, 'ACTIVE', '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-000000000004', 'lan.tran@vinacons.vn', crypt('Vinacons@2026', gen_salt('bf', 10)), N'Trần Thị Lan', '0903344552', 'TX-0031', 'WORKER', 'dec0de00-0000-4000-8000-000000000001', 'ACTIVE', '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-000000000005', 'hung.vo@vinacons.vn', crypt('Vinacons@2026', gen_salt('bf', 10)), N'Võ Văn Hùng', '0903344553', 'TX-0032', 'WORKER', 'dec0de00-0000-4000-8000-000000000002', 'ACTIVE', '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-000000000006', 'phuc.dang@vinacons.vn', crypt('Vinacons@2026', gen_salt('bf', 10)), N'Đặng Văn Phúc', '0903344554', 'TX-0033', 'WORKER', 'dec0de00-0000-4000-8000-000000000001', 'ACTIVE', '11111111-1111-4111-8111-111111111111')
ON CONFLICT DO NOTHING;

-- ── trades mới (bổ sung cho COP-PHA / cốt thép) ──────────────────────────
INSERT INTO trades (id, code, name, description, is_active)
VALUES
 ('dec0de00-0000-4000-8000-000000000007', 'COP-PHA', N'Thợ cốp pha', N'Thợ lắp dựng cốp pha dầm sàn cột vách', TRUE),
 ('dec0de00-0000-4000-8000-000000000008', 'THEP', N'Thợ cốt thép', N'Thợ gia công lắp dựng cốt thép', TRUE)
ON CONFLICT DO NOTHING;

-- ── user_roles cho user mới ──────────────────────────────────────────────
INSERT INTO user_roles (id, user_id, role_id, assigned_by, is_active)
VALUES
 ('dec0de00-0000-4000-8000-000000000009', 'dec0de00-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', TRUE),
 ('dec0de00-0000-4000-8000-00000000000A', 'dec0de00-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', TRUE),
 ('dec0de00-0000-4000-8000-00000000000B', 'dec0de00-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', TRUE),
 ('dec0de00-0000-4000-8000-00000000000C', 'dec0de00-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', TRUE),
 ('dec0de00-0000-4000-8000-00000000000D', 'dec0de00-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', TRUE)
ON CONFLICT DO NOTHING;

-- ── crews mới (mỗi crew đúng 1 LEAD ở crew_members) ──────────────────────
INSERT INTO crews (id, code, name, contractor_id, description, status, created_by)
VALUES
 ('dec0de00-0000-4000-8000-00000000000E', 'DOI-BT', N'Đội bê tông Vinacons', 'e2e4c000-0000-4000-8000-0000000000c1', N'Đội đổ bê tông dầm sàn', 'ACTIVE', '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-00000000000F', 'DOI-SON', N'Đội sơn nước An Phú', 'dec0de00-0000-4000-8000-000000000001', N'Đội sơn nước nội ngoại thất', 'ACTIVE', '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-000000000010', 'DOI-DIEN', N'Đội cơ điện Việt Thắng', 'dec0de00-0000-4000-8000-000000000002', N'Đội thi công điện nước', 'ACTIVE', '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-000000000011', 'DOI-COP', N'Đội cốp pha cốt thép Trường Hải', 'dec0de00-0000-4000-8000-000000000001', N'Đội cốp pha và cốt thép phần thô', 'ACTIVE', '11111111-1111-4111-8111-111111111111')
ON CONFLICT DO NOTHING;

-- ── crew_members (1 LEAD active/crew — ux_crew_one_active_lead) ───────────
INSERT INTO crew_members (id, crew_id, user_id, member_role, effective_from, is_active, added_by)
VALUES
 ('dec0de00-0000-4000-8000-000000000012', 'dec0de00-0000-4000-8000-00000000000E', 'dec0de00-0000-4000-8000-000000000004', 'LEAD', '2026-09-01', TRUE, '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-000000000013', 'dec0de00-0000-4000-8000-00000000000E', 'dec0de00-0000-4000-8000-000000000006', 'MEMBER', '2026-09-01', TRUE, '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-000000000014', 'dec0de00-0000-4000-8000-00000000000F', 'dec0de00-0000-4000-8000-000000000005', 'LEAD', '2026-09-01', TRUE, '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-000000000015', 'dec0de00-0000-4000-8000-00000000000F', 'dec0de00-0000-4000-8000-000000000004', 'MEMBER', '2026-09-02', TRUE, '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-000000000016', 'dec0de00-0000-4000-8000-000000000010', 'dec0de00-0000-4000-8000-000000000003', 'LEAD', '2026-09-01', TRUE, '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-000000000017', 'dec0de00-0000-4000-8000-000000000011', 'dec0de00-0000-4000-8000-000000000006', 'LEAD', '2026-09-03', TRUE, '11111111-1111-4111-8111-111111111111')
ON CONFLICT DO NOTHING;

-- ── resource_trades (USER và CREW) ───────────────────────────────────────
INSERT INTO resource_trades (id, resource_type, user_id, crew_id, trade_id, skill_level, effective_from, is_active)
VALUES
 ('dec0de00-0000-4000-8000-000000000018', 'USER', 'dec0de00-0000-4000-8000-000000000004', NULL, 'dec0de00-0000-4000-8000-000000000007', 3, '2026-09-01', TRUE),
 ('dec0de00-0000-4000-8000-000000000019', 'USER', 'dec0de00-0000-4000-8000-000000000005', NULL, '85fc5da0-cb00-4650-9e3c-fae7a83ab656', 2, '2026-09-01', TRUE),
 ('dec0de00-0000-4000-8000-00000000001A', 'USER', 'dec0de00-0000-4000-8000-000000000006', NULL, 'dec0de00-0000-4000-8000-000000000008', 2, '2026-09-03', TRUE),
 ('dec0de00-0000-4000-8000-00000000001B', 'CREW', NULL, 'dec0de00-0000-4000-8000-00000000000E', '11111111-1111-4111-8111-111111111111', 4, '2026-09-01', TRUE),
 ('dec0de00-0000-4000-8000-00000000001C', 'CREW', NULL, 'dec0de00-0000-4000-8000-00000000000F', 'e8f974e9-3d12-4f25-97cb-32bd81b843fd', 3, '2026-09-01', TRUE)
ON CONFLICT DO NOTHING;

-- ── project mới PRT ──────────────────────────────────────────────────────
INSERT INTO projects (id, code, name, description, address, planned_start_date, planned_end_date, manager_id, status, created_by)
VALUES
 ('dec0de00-0000-4000-8000-00000000001D', 'PRT', N'Khu dân cư ven sông Thủ Thiêm', N'Chung cư cao tầng và nhà phố ven sông', N'Đại lộ Mai Chí Thọ, TP. Thủ Đức, TP.HCM', '2026-09-01', '2027-12-31', '22222222-2222-4222-8222-222222222222', 'ACTIVE', '11111111-1111-4111-8111-111111111111')
ON CONFLICT DO NOTHING;

-- ── project_areas cho PRT ────────────────────────────────────────────────
INSERT INTO project_areas (id, project_id, code, name, description, display_order, is_active)
VALUES
 ('dec0de00-0000-4000-8000-00000000001E', 'dec0de00-0000-4000-8000-00000000001D', 'TH-01', N'Tháp A - Tầng điển hình', N'Khối tháp A từ tầng 3 đến tầng 20', 1, TRUE),
 ('dec0de00-0000-4000-8000-00000000001F', 'dec0de00-0000-4000-8000-00000000001D', 'TH-02', N'Tháp B - Tầng điển hình', N'Khối tháp B từ tầng 3 đến tầng 18', 2, TRUE),
 ('dec0de00-0000-4000-8000-000000000020', 'dec0de00-0000-4000-8000-00000000001D', 'HM-01', N'Hầm để xe B1', N'Tầng hầm để xe và kỹ thuật', 3, TRUE)
ON CONFLICT DO NOTHING;

-- ── project_members cho PRT ──────────────────────────────────────────────
INSERT INTO project_members (id, project_id, user_id, project_role, is_active, added_by)
VALUES
 ('dec0de00-0000-4000-8000-000000000021', 'dec0de00-0000-4000-8000-00000000001D', 'dec0de00-0000-4000-8000-000000000003', 'MANAGER', TRUE, '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-000000000022', 'dec0de00-0000-4000-8000-00000000001D', 'dec0de00-0000-4000-8000-000000000004', 'WORKER', TRUE, '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-000000000023', 'dec0de00-0000-4000-8000-00000000001D', 'dec0de00-0000-4000-8000-000000000005', 'WORKER', TRUE, '11111111-1111-4111-8111-111111111111')
ON CONFLICT DO NOTHING;

-- ── work_orders (8 trạng thái; board ĐÓNG; chỉ ở PRD + PRT) ───────────────
INSERT INTO work_orders (id, code, project_id, area_id, work_type_id, required_trade_id, title, description, instructions, priority, status, planned_start_at, planned_end_at, progress_percent, job_board_open, planned_headcount, created_by, cancel_reason, actual_start_at, work_done_at, closed_at)
VALUES
 ('dec0de00-0000-4000-8000-000000000024', 'WO-PRT-001', 'dec0de00-0000-4000-8000-00000000001D', 'dec0de00-0000-4000-8000-00000000001E', 'e2e4b200-0000-4000-8000-0000000000b3', '11111111-1111-4111-8111-111111111111', N'Đổ bê tông cột vách tầng 5 tháp A', N'Đổ bê tông cột vách tầng 5 theo bản vẽ KC-THA-05', N'Kiểm tra cốp pha và cốt thép trước khi đổ; đầm kỹ không rỗ tổ ong', 'HIGH', 'DRAFT', '2026-09-15T01:00:00Z', '2026-09-17T10:00:00Z', 0, FALSE, 8, '22222222-2222-4222-8222-222222222222', NULL, NULL, NULL, NULL),
 ('dec0de00-0000-4000-8000-000000000025', 'WO-PRT-002', 'dec0de00-0000-4000-8000-00000000001D', 'dec0de00-0000-4000-8000-00000000001E', 'e2e4b200-0000-4000-8000-0000000000b3', '11111111-1111-4111-8111-111111111111', N'Lắp dựng cốp pha dầm sàn tầng 5 tháp A', N'Cốp pha dầm sàn tầng 5 tháp A theo bản vẽ KC-THA-05', N'Cân chỉnh cao độ bằng máy thủy bình; chống tăng đúng khoảng cách', 'NORMAL', 'READY', '2026-09-12T01:00:00Z', '2026-09-14T10:00:00Z', 0, FALSE, 6, '22222222-2222-4222-8222-222222222222', NULL, NULL, NULL, NULL),
 ('dec0de00-0000-4000-8000-000000000026', 'WO-PRT-003', 'dec0de00-0000-4000-8000-00000000001D', 'dec0de00-0000-4000-8000-000000000020', 'a1b2c3d4-0001-4000-8000-000000000001', 'e8f974e9-3d12-4f25-97cb-32bd81b843fd', N'Chống thấm sàn hầm B1', N'Chống thấm sàn và vách hầm B1 bằng màng khò nóng', N'Vệ sinh bề mặt; khò màng đúng chồng mí 10cm; thử nước 48 giờ', 'HIGH', 'OPEN', '2026-09-10T01:00:00Z', '2026-09-13T10:00:00Z', 10, FALSE, 5, '22222222-2222-4222-8222-222222222222', NULL, NULL, NULL, NULL),
 ('dec0de00-0000-4000-8000-000000000027', 'WO-PRD-101', 'e2e4b000-0000-4000-8000-0000000000b1', '0e0fb841-f7c8-4b55-8681-ae9e98b28f6c', 'a1b2c3d4-0003-4000-8000-000000000003', 'b017178a-daf2-4614-ac34-a05e1d1a6fb7', N'Ốp lát gạch nền khu khám tầng 2', N'Ốp lát gạch nền 600x600 khu khám chữa bệnh tầng 2', N'Cán nền đúng cao độ; mạch gạch đều 2mm; vệ sinh mạch sau 24 giờ', 'NORMAL', 'ASSIGNED', '2026-09-09T01:00:00Z', '2026-09-12T10:00:00Z', 20, FALSE, 4, '22222222-2222-4222-8222-222222222222', NULL, '2026-09-09T01:30:00Z', NULL, NULL),
 ('dec0de00-0000-4000-8000-000000000028', 'WO-PRD-102', 'e2e4b000-0000-4000-8000-0000000000b1', '832b8214-89d9-4440-b362-a1854ebd1a13', 'a1b2c3d4-0002-4000-8000-000000000002', '85fc5da0-cb00-4650-9e3c-fae7a83ab656', N'Đi ống điện âm tường khu phẫu thuật tầng 4', N'Đi ống luồn dây và đế âm cho khu phẫu thuật tầng 4', N'Cắt tường đúng tuyến bản vẽ MĐ-PT4; ống D20; nghiệm thu trước trát', 'HIGH', 'IN_PROGRESS', '2026-09-05T01:00:00Z', '2026-09-11T10:00:00Z', 45, FALSE, 5, '22222222-2222-4222-8222-222222222222', NULL, '2026-09-05T01:00:00Z', NULL, NULL),
 ('dec0de00-0000-4000-8000-000000000029', 'WO-PRD-103', 'e2e4b000-0000-4000-8000-0000000000b1', 'e2e4b100-0000-4000-8000-0000000000b2', 'a1b2c3d4-0004-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', N'Bảo dưỡng bê tông sàn tầng hầm B1', N'Bảo dưỡng ẩm bê tông sàn hầm B1 sau đổ 7 ngày', N'Tưới ẩm 3 lần mỗi ngày; phủ bao tải giữ ẩm', 'LOW', 'WORK_DONE', '2026-09-01T01:00:00Z', '2026-09-08T10:00:00Z', 100, FALSE, 3, '22222222-2222-4222-8222-222222222222', NULL, '2026-09-01T01:00:00Z', '2026-09-08T09:00:00Z', NULL),
 ('dec0de00-0000-4000-8000-00000000002A', 'WO-PRT-004', 'dec0de00-0000-4000-8000-00000000001D', 'dec0de00-0000-4000-8000-00000000001F', 'a1b2c3d4-0001-4000-8000-000000000001', 'e8f974e9-3d12-4f25-97cb-32bd81b843fd', N'Sơn nước tường nội thất tầng 4 tháp B', N'Sơn nước 2 lớp tường nội thất tầng 4 tháp B', N'Bả matit 2 lớp; sơn lót 1 lớp; sơn phủ 2 lớp', 'NORMAL', 'CLOSED', '2026-08-20T01:00:00Z', '2026-08-28T10:00:00Z', 100, FALSE, 4, '22222222-2222-4222-8222-222222222222', NULL, '2026-08-20T01:00:00Z', '2026-08-27T09:00:00Z', '2026-08-28T09:00:00Z'),
 ('dec0de00-0000-4000-8000-00000000002B', 'WO-PRT-005', 'dec0de00-0000-4000-8000-00000000001D', 'dec0de00-0000-4000-8000-00000000001E', 'e2e4b200-0000-4000-8000-0000000000b3', '11111111-1111-4111-8111-111111111111', N'Gia công lắp dựng cốt thép dầm tầng 6 tháp A', N'Cốt thép dầm tầng 6 tháp A theo bản vẽ KC-THA-06', N'Gia công đúng chủng loại; buộc đúng khoảng cách đai', 'NORMAL', 'CANCELLED', '2026-09-18T01:00:00Z', '2026-09-20T10:00:00Z', 0, FALSE, 5, '22222222-2222-4222-8222-222222222222', N'Hủy do điều chỉnh thiết kế dầm D3', NULL, NULL, NULL)
ON CONFLICT DO NOTHING;

-- ── work_order_dependencies (cùng project; FINISH_TO_START) ───────────────
INSERT INTO work_order_dependencies (id, work_order_id, predecessor_work_order_id, dependency_type, is_blocking, created_by)
VALUES
 ('dec0de00-0000-4000-8000-00000000002C', 'dec0de00-0000-4000-8000-000000000025', 'dec0de00-0000-4000-8000-000000000024', 'FINISH_TO_START', TRUE, '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-00000000002D', 'dec0de00-0000-4000-8000-00000000002A', 'dec0de00-0000-4000-8000-000000000025', 'FINISH_TO_START', FALSE, '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-00000000002E', 'dec0de00-0000-4000-8000-00000000002B', 'dec0de00-0000-4000-8000-000000000024', 'FINISH_TO_START', TRUE, '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-00000000002F', 'dec0de00-0000-4000-8000-000000000028', 'dec0de00-0000-4000-8000-000000000027', 'FINISH_TO_START', TRUE, '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-000000000030', 'dec0de00-0000-4000-8000-000000000029', 'dec0de00-0000-4000-8000-000000000028', 'FINISH_TO_START', FALSE, '11111111-1111-4111-8111-111111111111')
ON CONFLICT DO NOTHING;

-- ── assignments (mỗi WO tối đa 1 PENDING/ACTIVE — ux_assignments_current) ─
INSERT INTO assignments (id, work_order_id, assignee_type, worker_id, crew_id, responsible_user_id, source, status, assigned_by, ended_at, end_reason)
VALUES
 ('dec0de00-0000-4000-8000-000000000031', 'dec0de00-0000-4000-8000-000000000027', 'USER', 'dec0de00-0000-4000-8000-000000000004', NULL, 'dec0de00-0000-4000-8000-000000000004', 'DIRECT_ASSIGNMENT', 'ACTIVE', '22222222-2222-4222-8222-222222222222', NULL, NULL),
 ('dec0de00-0000-4000-8000-000000000032', 'dec0de00-0000-4000-8000-000000000028', 'CREW', NULL, 'dec0de00-0000-4000-8000-00000000000E', 'dec0de00-0000-4000-8000-000000000003', 'DIRECT_ASSIGNMENT', 'ACTIVE', '22222222-2222-4222-8222-222222222222', NULL, NULL),
 ('dec0de00-0000-4000-8000-000000000033', 'dec0de00-0000-4000-8000-000000000024', 'USER', 'dec0de00-0000-4000-8000-000000000006', NULL, 'dec0de00-0000-4000-8000-000000000006', 'SELF_ACCEPT', 'PENDING_ACCEPTANCE', NULL, NULL, NULL),
 ('dec0de00-0000-4000-8000-000000000034', 'dec0de00-0000-4000-8000-000000000025', 'USER', 'dec0de00-0000-4000-8000-000000000005', NULL, 'dec0de00-0000-4000-8000-000000000005', 'DIRECT_ASSIGNMENT', 'ENDED', '22222222-2222-4222-8222-222222222222', '2026-09-09T02:00:00Z', N'Điều chuyển sang đội cốp pha'),
 ('dec0de00-0000-4000-8000-000000000035', 'dec0de00-0000-4000-8000-000000000026', 'CREW', NULL, 'dec0de00-0000-4000-8000-00000000000F', 'dec0de00-0000-4000-8000-000000000003', 'REASSIGNMENT', 'WITHDRAWN', '22222222-2222-4222-8222-222222222222', '2026-09-09T03:00:00Z', N'Thu hồi do thiếu vật tư chống thấm')
ON CONFLICT DO NOTHING;

-- ── work_order_state_history ─────────────────────────────────────────────
INSERT INTO work_order_state_history (id, work_order_id, from_status, to_status, changed_by, assignment_id, reason)
VALUES
 ('dec0de00-0000-4000-8000-000000000036', 'dec0de00-0000-4000-8000-000000000024', NULL, 'DRAFT', '22222222-2222-4222-8222-222222222222', NULL, N'Tạo việc đổ bê tông cột vách'),
 ('dec0de00-0000-4000-8000-000000000037', 'dec0de00-0000-4000-8000-000000000025', 'DRAFT', 'READY', '22222222-2222-4222-8222-222222222222', NULL, N'Đủ điều kiện sẵn sàng'),
 ('dec0de00-0000-4000-8000-000000000038', 'dec0de00-0000-4000-8000-000000000026', 'READY', 'OPEN', '22222222-2222-4222-8222-222222222222', NULL, N'Mở thi công chống thấm'),
 ('dec0de00-0000-4000-8000-000000000039', 'dec0de00-0000-4000-8000-000000000027', 'OPEN', 'ASSIGNED', '22222222-2222-4222-8222-222222222222', 'dec0de00-0000-4000-8000-000000000031', N'Gán thợ ốp lát'),
 ('dec0de00-0000-4000-8000-00000000003A', 'dec0de00-0000-4000-8000-000000000028', 'ASSIGNED', 'IN_PROGRESS', 'dec0de00-0000-4000-8000-000000000003', NULL, N'Bắt đầu đi ống điện'),
 ('dec0de00-0000-4000-8000-00000000003B', 'dec0de00-0000-4000-8000-000000000029', 'IN_PROGRESS', 'WORK_DONE', 'dec0de00-0000-4000-8000-000000000003', NULL, N'Hoàn thành bảo dưỡng'),
 ('dec0de00-0000-4000-8000-00000000003C', 'dec0de00-0000-4000-8000-00000000002A', 'WORK_DONE', 'CLOSED', '22222222-2222-4222-8222-222222222222', NULL, N'Nghiệm thu đạt, đóng việc'),
 ('dec0de00-0000-4000-8000-00000000003D', 'dec0de00-0000-4000-8000-00000000002B', 'OPEN', 'CANCELLED', '22222222-2222-4222-8222-222222222222', NULL, N'Hủy do điều chỉnh thiết kế')
ON CONFLICT DO NOTHING;

-- ── work_order_updates ───────────────────────────────────────────────────
INSERT INTO work_order_updates (id, work_order_id, update_type, progress_percent, content, created_by)
VALUES
 ('dec0de00-0000-4000-8000-00000000003E', 'dec0de00-0000-4000-8000-000000000028', 'START', 5, N'Bắt đầu đi ống điện âm tường khu phẫu thuật, tập kết vật tư đầy đủ', 'dec0de00-0000-4000-8000-000000000003'),
 ('dec0de00-0000-4000-8000-00000000003F', 'dec0de00-0000-4000-8000-000000000028', 'PROGRESS', 45, N'Đã đi xong 45% tuyến ống tầng 4, đang chờ nghiệm thu trước khi trát', 'dec0de00-0000-4000-8000-000000000003'),
 ('dec0de00-0000-4000-8000-000000000040', 'dec0de00-0000-4000-8000-000000000027', 'DAILY_LOG', 20, N'Nhật ký ngày 09/09: cán nền đạt 60m2, mạch thử đạt yêu cầu', 'dec0de00-0000-4000-8000-000000000004'),
 ('dec0de00-0000-4000-8000-000000000041', 'dec0de00-0000-4000-8000-000000000029', 'NOTE', 100, N'Ghi chú: tăng cường tưới ẩm buổi trưa do nắng gắt', 'dec0de00-0000-4000-8000-000000000006'),
 ('dec0de00-0000-4000-8000-000000000042', 'dec0de00-0000-4000-8000-000000000029', 'WORK_DONE_SUBMISSION', 100, N'Đề nghị nghiệm thu công tác bảo dưỡng bê tông sàn hầm B1', 'dec0de00-0000-4000-8000-000000000003')
ON CONFLICT DO NOTHING;

-- ── materials ────────────────────────────────────────────────────────────
INSERT INTO materials (id, code, name, category, unit, description, is_active)
VALUES
 ('dec0de00-0000-4000-8000-00000000004E', 'VL-BT-M300', N'Bê tông tươi mác 300', N'Bê tông', 'm3', N'Bê tông tươi độ sụt 12cm', TRUE),
 ('dec0de00-0000-4000-8000-00000000004F', 'VL-XM-PC40', N'Xi măng PCB40', N'Xi măng', N'bao', N'Bao 50kg', TRUE),
 ('dec0de00-0000-4000-8000-000000000050', 'VL-GACH-6060', N'Gạch lát nền 600x600', N'Gạch ốp lát', N'thùng', N'Gạch granite men mờ', TRUE),
 ('dec0de00-0000-4000-8000-000000000051', 'VL-SON-NT18', N'Sơn nước nội thất 18L', N'Sơn', N'thùng', N'Sơn phủ nội thất màu trắng', TRUE),
 ('dec0de00-0000-4000-8000-000000000052', 'VL-ONG-D20', N'Ống luồn dây điện D20', N'Vật tư điện', N'cây', N'Ống PVC luồn dây âm tường', TRUE)
ON CONFLICT DO NOTHING;

-- ── work_order_materials ─────────────────────────────────────────────────
INSERT INTO work_order_materials (id, work_order_id, material_id, planned_quantity, available_quantity, readiness_status, last_checked_by, created_by)
VALUES
 ('dec0de00-0000-4000-8000-000000000053', 'dec0de00-0000-4000-8000-000000000024', 'dec0de00-0000-4000-8000-00000000004E', 50, 50, 'READY', 'dec0de00-0000-4000-8000-000000000003', 'dec0de00-0000-4000-8000-000000000003'),
 ('dec0de00-0000-4000-8000-000000000054', 'dec0de00-0000-4000-8000-000000000027', 'dec0de00-0000-4000-8000-000000000050', 120, 60, 'SHORTAGE', 'dec0de00-0000-4000-8000-000000000003', 'dec0de00-0000-4000-8000-000000000003'),
 ('dec0de00-0000-4000-8000-000000000055', 'dec0de00-0000-4000-8000-000000000028', 'dec0de00-0000-4000-8000-000000000052', 200, 200, 'READY', 'dec0de00-0000-4000-8000-000000000003', 'dec0de00-0000-4000-8000-000000000003'),
 ('dec0de00-0000-4000-8000-000000000056', 'dec0de00-0000-4000-8000-00000000002A', 'dec0de00-0000-4000-8000-000000000051', 30, 30, 'READY', 'dec0de00-0000-4000-8000-000000000003', 'dec0de00-0000-4000-8000-000000000003'),
 ('dec0de00-0000-4000-8000-000000000057', 'dec0de00-0000-4000-8000-000000000029', 'dec0de00-0000-4000-8000-00000000004F', 100, NULL, 'NOT_CHECKED', NULL, 'dec0de00-0000-4000-8000-000000000003'),
 ('dec0de00-0000-4000-8000-000000000058', 'dec0de00-0000-4000-8000-000000000026', 'dec0de00-0000-4000-8000-000000000051', 15, 0, 'SHORTAGE', 'dec0de00-0000-4000-8000-000000000003', 'dec0de00-0000-4000-8000-000000000003')
ON CONFLICT DO NOTHING;

-- ── work_order_readiness_checks ──────────────────────────────────────────
INSERT INTO work_order_readiness_checks (id, work_order_id, attempt_no, overall_status, checked_by, note, overridden_by, override_reason)
VALUES
 ('dec0de00-0000-4000-8000-000000000043', 'dec0de00-0000-4000-8000-000000000025', 1, 'READY', 'dec0de00-0000-4000-8000-000000000003', N'Đủ nhân lực vật tư mặt bằng', NULL, NULL),
 ('dec0de00-0000-4000-8000-000000000044', 'dec0de00-0000-4000-8000-000000000026', 1, 'NOT_READY', 'dec0de00-0000-4000-8000-000000000003', N'Thiếu sơn chống thấm', NULL, NULL),
 ('dec0de00-0000-4000-8000-000000000045', 'dec0de00-0000-4000-8000-000000000027', 1, 'READY_WITH_CONSTRAINT', 'dec0de00-0000-4000-8000-000000000003', N'Triển khai từng đợt theo vật tư về', '22222222-2222-4222-8222-222222222222', N'Cho phép làm cuốn chiếu theo tiến độ gạch về'),
 ('dec0de00-0000-4000-8000-000000000046', 'dec0de00-0000-4000-8000-000000000028', 1, 'READY', 'dec0de00-0000-4000-8000-000000000003', N'Đủ điều kiện thi công điện', NULL, NULL),
 ('dec0de00-0000-4000-8000-000000000047', 'dec0de00-0000-4000-8000-000000000024', 1, 'NOT_READY', 'dec0de00-0000-4000-8000-000000000003', N'Chờ bản vẽ shop drawing cột vách', NULL, NULL)
ON CONFLICT DO NOTHING;

-- ── readiness_check_items (ref nullable — giữ đúng thứ tự FK graph) ──────
INSERT INTO readiness_check_items (id, readiness_check_id, category, result, is_blocking, dependency_id, work_order_material_id, checkpoint_id, note)
VALUES
 ('dec0de00-0000-4000-8000-000000000048', 'dec0de00-0000-4000-8000-000000000043', 'DEPENDENCY', 'READY', FALSE, 'dec0de00-0000-4000-8000-00000000002C', NULL, NULL, N'Việc trước đã sẵn sàng mặt bằng'),
 ('dec0de00-0000-4000-8000-000000000049', 'dec0de00-0000-4000-8000-000000000043', 'MANPOWER', 'READY', FALSE, NULL, NULL, NULL, N'Đội cốp pha đủ 6 người'),
 ('dec0de00-0000-4000-8000-00000000004A', 'dec0de00-0000-4000-8000-000000000044', 'MATERIAL', 'BLOCKING', TRUE, NULL, NULL, NULL, N'Thiếu sơn chống thấm, đã lập phiếu bổ sung'),
 ('dec0de00-0000-4000-8000-00000000004B', 'dec0de00-0000-4000-8000-000000000045', 'SITE_ACCESS', 'CONSTRAINT', FALSE, NULL, NULL, NULL, N'Mặt bằng tầng 2 bàn giao từng nửa sàn'),
 ('dec0de00-0000-4000-8000-00000000004C', 'dec0de00-0000-4000-8000-000000000046', 'INFORMATION', 'READY', FALSE, NULL, NULL, NULL, N'Bản vẽ điện PT4 đã phát hành'),
 ('dec0de00-0000-4000-8000-00000000004D', 'dec0de00-0000-4000-8000-000000000047', 'OTHER', 'NOT_APPLICABLE', FALSE, NULL, NULL, NULL, N'Không áp dụng hạng mục này')
ON CONFLICT DO NOTHING;

-- ── work_order_blockers ──────────────────────────────────────────────────
INSERT INTO work_order_blockers (id, work_order_id, readiness_item_id, blocker_type, impact_level, is_blocking, description, reported_by, responsible_party_type, responsible_user_id, responsible_crew_id, status, opened_at, acknowledged_at, resolving_at, resolved_at, resolution_note)
VALUES
 ('dec0de00-0000-4000-8000-000000000059', 'dec0de00-0000-4000-8000-000000000026', 'dec0de00-0000-4000-8000-00000000004A', 'MATERIAL', 'HIGH', TRUE, N'Thiếu sơn chống thấm cho sàn hầm B1, cần bổ sung gấp', 'dec0de00-0000-4000-8000-000000000003', 'USER', 'dec0de00-0000-4000-8000-000000000004', NULL, 'OPEN', '2026-09-08T01:00:00Z', NULL, NULL, NULL, NULL),
 ('dec0de00-0000-4000-8000-00000000005A', 'dec0de00-0000-4000-8000-000000000027', NULL, 'MANPOWER', 'MEDIUM', TRUE, N'Thiếu 2 thợ ốp lát cho khu khám tầng 2', 'dec0de00-0000-4000-8000-000000000003', 'CREW', NULL, 'dec0de00-0000-4000-8000-00000000000F', 'ACKNOWLEDGED', '2026-09-08T02:00:00Z', '2026-09-08T05:00:00Z', NULL, NULL, NULL),
 ('dec0de00-0000-4000-8000-00000000005B', 'dec0de00-0000-4000-8000-000000000024', NULL, 'DRAWING_INFORMATION', 'LOW', FALSE, N'Chờ bản vẽ shop drawing cột vách tầng 5', 'dec0de00-0000-4000-8000-000000000003', 'UNASSIGNED', NULL, NULL, 'RESOLVED', '2026-09-07T01:00:00Z', '2026-09-07T03:00:00Z', '2026-09-07T06:00:00Z', '2026-09-08T01:00:00Z', N'Đã nhận bản vẽ từ tư vấn thiết kế'),
 ('dec0de00-0000-4000-8000-00000000005C', 'dec0de00-0000-4000-8000-000000000028', NULL, 'EQUIPMENT', 'MEDIUM', TRUE, N'Máy cắt sắt cầm tay hỏng, chờ sửa chữa', 'dec0de00-0000-4000-8000-000000000003', 'EXTERNAL', NULL, NULL, 'RESOLVING', '2026-09-08T03:00:00Z', '2026-09-08T04:00:00Z', '2026-09-08T07:00:00Z', NULL, NULL),
 ('dec0de00-0000-4000-8000-00000000005D', 'dec0de00-0000-4000-8000-00000000002B', NULL, 'WEATHER', 'LOW', FALSE, N'Mưa lớn buổi chiều, ghi nhận ảnh hưởng tiến độ', 'dec0de00-0000-4000-8000-000000000003', 'UNASSIGNED', NULL, NULL, 'CANCELLED', '2026-09-08T04:00:00Z', NULL, NULL, NULL, NULL)
ON CONFLICT DO NOTHING;

-- ── material_supplement_requests (MSR-001 blocking → blocker 59) ─────────
INSERT INTO material_supplement_requests (id, request_code, work_order_id, work_order_material_id, material_id, requested_quantity, reason, is_blocking, blocker_id, status, requested_by, acknowledged_by, acknowledged_at, fulfilled_by, fulfilled_at, cancelled_by, cancelled_at, cancel_reason)
VALUES
 ('dec0de00-0000-4000-8000-00000000005E', 'MSR-2609-001', 'dec0de00-0000-4000-8000-000000000026', 'dec0de00-0000-4000-8000-000000000058', 'dec0de00-0000-4000-8000-000000000051', 10, N'Bổ sung sơn chống thấm cho sàn hầm B1 đang thiếu', TRUE, 'dec0de00-0000-4000-8000-000000000059', 'REQUESTED', 'dec0de00-0000-4000-8000-000000000003', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
 ('dec0de00-0000-4000-8000-00000000005F', 'MSR-2609-002', 'dec0de00-0000-4000-8000-000000000027', 'dec0de00-0000-4000-8000-000000000054', 'dec0de00-0000-4000-8000-000000000050', 60, N'Bổ sung gạch lát nền đợt 2 cho khu khám tầng 2', FALSE, NULL, 'REQUESTED', 'dec0de00-0000-4000-8000-000000000003', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
 ('dec0de00-0000-4000-8000-000000000060', 'MSR-2609-003', 'dec0de00-0000-4000-8000-000000000028', 'dec0de00-0000-4000-8000-000000000055', 'dec0de00-0000-4000-8000-000000000052', 50, N'Bổ sung ống D20 cho tuyến còn lại tầng 4', FALSE, NULL, 'ACKNOWLEDGED', 'dec0de00-0000-4000-8000-000000000003', 'dec0de00-0000-4000-8000-000000000003', '2026-09-08T06:00:00Z', NULL, NULL, NULL, NULL, NULL),
 ('dec0de00-0000-4000-8000-000000000061', 'MSR-2609-004', 'dec0de00-0000-4000-8000-000000000024', 'dec0de00-0000-4000-8000-000000000053', 'dec0de00-0000-4000-8000-00000000004E', 12, N'Bổ sung bê tông cho khối lượng phát sinh cổ cột', FALSE, NULL, 'FULFILLED', 'dec0de00-0000-4000-8000-000000000003', 'dec0de00-0000-4000-8000-000000000003', '2026-09-07T06:00:00Z', '22222222-2222-4222-8222-222222222222', '2026-09-07T09:00:00Z', NULL, NULL, NULL),
 ('dec0de00-0000-4000-8000-000000000062', 'MSR-2609-005', 'dec0de00-0000-4000-8000-000000000029', 'dec0de00-0000-4000-8000-000000000057', 'dec0de00-0000-4000-8000-00000000004F', 20, N'Xi măng dự phòng bảo dưỡng (hủy do đủ vật tư)', FALSE, NULL, 'CANCELLED', 'dec0de00-0000-4000-8000-000000000003', NULL, NULL, NULL, NULL, 'dec0de00-0000-4000-8000-000000000003', '2026-09-08T08:00:00Z', N'Kho còn đủ xi măng')
ON CONFLICT DO NOTHING;

-- ── checklist_templates ──────────────────────────────────────────────────
INSERT INTO checklist_templates (id, code, name, work_type_id, purpose, version, status, description, created_by)
VALUES
 ('dec0de00-0000-4000-8000-000000000063', 'CLT-BT-COT', N'Nghiệm thu đổ bê tông cột vách', 'e2e4b200-0000-4000-8000-0000000000b3', 'PRE_START', 1, 'ACTIVE', N'Danh mục kiểm tra trước khi đổ bê tông', '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-000000000064', 'CLT-OPLAT-NEN', N'Nghiệm thu ốp lát nền', 'a1b2c3d4-0003-4000-8000-000000000003', 'WORK_DONE', 1, 'ACTIVE', N'Danh mục nghiệm thu ốp lát', '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-000000000065', 'CLT-DIEN-AT', N'Kiểm tra điện âm tường', 'a1b2c3d4-0002-4000-8000-000000000002', 'INSPECTION', 1, 'ACTIVE', N'Danh mục kiểm tra tuyến ống điện', '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-000000000066', 'CLT-SON-NT', N'Nghiệm thu sơn nước nội thất', 'a1b2c3d4-0001-4000-8000-000000000001', 'WORK_DONE', 1, 'DRAFT', N'Danh mục nghiệm thu sơn (đang soạn)', '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-000000000067', 'CLT-ATLD-DV', N'An toàn lao động đầu ca', NULL, 'PRE_START', 1, 'ACTIVE', N'Danh mục an toàn dùng chung mọi công việc', '11111111-1111-4111-8111-111111111111')
ON CONFLICT DO NOTHING;

-- ── checklist_template_items ─────────────────────────────────────────────
INSERT INTO checklist_template_items (id, template_id, sequence_no, title, description, answer_type, is_required, is_blocking, requires_photo, min_value, max_value)
VALUES
 ('dec0de00-0000-4000-8000-000000000068', 'dec0de00-0000-4000-8000-000000000063', 1, N'Cốp pha kín khít, chống xê dịch', N'Kiểm tra toàn bộ mặt cốp pha cột vách', 'PASS_FAIL', TRUE, TRUE, TRUE, NULL, NULL),
 ('dec0de00-0000-4000-8000-000000000069', 'dec0de00-0000-4000-8000-000000000063', 2, N'Độ sụt bê tông (cm)', N'Đo độ sụt tại xe bồn trước khi đổ', 'NUMBER', TRUE, FALSE, FALSE, 10, 18),
 ('dec0de00-0000-4000-8000-00000000006A', 'dec0de00-0000-4000-8000-000000000066', 1, N'Bề mặt tường phẳng, không bong rộp', NULL, 'PASS_FAIL', TRUE, FALSE, TRUE, NULL, NULL),
 ('dec0de00-0000-4000-8000-00000000006B', 'dec0de00-0000-4000-8000-000000000065', 1, N'Ống luồn đúng tuyến bản vẽ', NULL, 'YES_NO', TRUE, TRUE, FALSE, NULL, NULL),
 ('dec0de00-0000-4000-8000-00000000006C', 'dec0de00-0000-4000-8000-000000000067', 1, N'Công nhân đội mũ bảo hộ', NULL, 'YES_NO', TRUE, TRUE, FALSE, NULL, NULL),
 ('dec0de00-0000-4000-8000-00000000006D', 'dec0de00-0000-4000-8000-000000000067', 2, N'Ghi chú an toàn ca làm việc', NULL, 'TEXT', FALSE, FALSE, FALSE, NULL, NULL),
 ('dec0de00-0000-4000-8000-000000000097', 'dec0de00-0000-4000-8000-000000000064', 1, N'Mạch gạch đều, không bể mẻ', NULL, 'PASS_FAIL', TRUE, FALSE, TRUE, NULL, NULL)
ON CONFLICT DO NOTHING;

-- ── inspection_checkpoint_templates ──────────────────────────────────────
INSERT INTO inspection_checkpoint_templates (id, work_type_id, code, name, checkpoint_type, sequence_no, stage_label, is_blocking, checklist_template_id, is_active, created_by)
VALUES
 ('dec0de00-0000-4000-8000-00000000006E', 'e2e4b200-0000-4000-8000-0000000000b3', 'ICT-BT-HP', N'Hold point nghiệm thu cốt thép', 'HOLD_POINT', 1, N'Trước khi đổ bê tông', TRUE, 'dec0de00-0000-4000-8000-000000000063', TRUE, '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-00000000006F', 'e2e4b200-0000-4000-8000-0000000000b3', 'ICT-BT-FINAL', N'Nghiệm thu hoàn thành bê tông', 'FINAL', 2, N'Sau khi đủ cường độ', FALSE, NULL, TRUE, '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-000000000070', 'a1b2c3d4-0003-4000-8000-000000000003', 'ICT-OP-FINAL', N'Nghiệm thu hoàn thành ốp lát', 'FINAL', 1, N'Sau khi vệ sinh mạch', FALSE, 'dec0de00-0000-4000-8000-000000000064', TRUE, '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-000000000071', 'a1b2c3d4-0002-4000-8000-000000000002', 'ICT-DIEN-PRE', N'Kiểm tra trước đóng điện', 'PRE_ACTIVITY', 1, N'Trước khi trát tường', TRUE, 'dec0de00-0000-4000-8000-000000000065', TRUE, '11111111-1111-4111-8111-111111111111'),
 ('dec0de00-0000-4000-8000-000000000072', 'a1b2c3d4-0001-4000-8000-000000000001', 'ICT-SON-WIT', N'Chứng kiến sơn lót', 'WITNESS_POINT', 1, N'Lớp sơn lót', FALSE, NULL, TRUE, '11111111-1111-4111-8111-111111111111')
ON CONFLICT DO NOTHING;

-- ── inspection_checkpoints ───────────────────────────────────────────────
INSERT INTO inspection_checkpoints (id, work_order_id, source_template_id, checkpoint_type, sequence_no, stage_label, is_blocking, checklist_template_id, status, requested_by, requested_at, released_by, released_at, note)
VALUES
 ('dec0de00-0000-4000-8000-000000000073', 'dec0de00-0000-4000-8000-000000000024', 'dec0de00-0000-4000-8000-00000000006E', 'HOLD_POINT', 1, N'Trước khi đổ bê tông', TRUE, 'dec0de00-0000-4000-8000-000000000063', 'PENDING', '22222222-2222-4222-8222-222222222222', '2026-09-09T01:00:00Z', NULL, NULL, N'Chờ nghiệm thu cốt thép cột vách'),
 ('dec0de00-0000-4000-8000-000000000074', 'dec0de00-0000-4000-8000-000000000027', 'dec0de00-0000-4000-8000-000000000070', 'FINAL', 1, N'Sau khi vệ sinh mạch', FALSE, 'dec0de00-0000-4000-8000-000000000064', 'IN_PROGRESS', '22222222-2222-4222-8222-222222222222', '2026-09-09T01:00:00Z', NULL, NULL, N'Đang nghiệm thu đợt 1'),
 ('dec0de00-0000-4000-8000-000000000075', 'dec0de00-0000-4000-8000-000000000028', 'dec0de00-0000-4000-8000-000000000071', 'PRE_ACTIVITY', 1, N'Trước khi trát tường', TRUE, 'dec0de00-0000-4000-8000-000000000065', 'READY_FOR_INSPECTION', '22222222-2222-4222-8222-222222222222', '2026-09-08T01:00:00Z', NULL, NULL, N'Sẵn sàng kiểm tra tuyến ống'),
 ('dec0de00-0000-4000-8000-000000000076', 'dec0de00-0000-4000-8000-00000000002A', 'dec0de00-0000-4000-8000-000000000072', 'WITNESS_POINT', 1, N'Lớp sơn lót', FALSE, NULL, 'RELEASED', '22222222-2222-4222-8222-222222222222', '2026-08-25T01:00:00Z', '11111111-1111-4111-8111-111111111111', '2026-08-25T08:00:00Z', N'Đã chứng kiến đạt'),
 ('dec0de00-0000-4000-8000-000000000077', 'dec0de00-0000-4000-8000-000000000029', NULL, 'FINAL', 1, N'Sau bảo dưỡng 7 ngày', FALSE, NULL, 'PENDING', '22222222-2222-4222-8222-222222222222', '2026-09-09T01:00:00Z', NULL, NULL, N'Chờ nghiệm thu bảo dưỡng')
ON CONFLICT DO NOTHING;

-- ── checklist_instances ──────────────────────────────────────────────────
INSERT INTO checklist_instances (id, work_order_id, template_id, checkpoint_id, purpose, instance_no, status, assigned_user_id, started_at, completed_at)
VALUES
 ('dec0de00-0000-4000-8000-000000000078', 'dec0de00-0000-4000-8000-000000000024', 'dec0de00-0000-4000-8000-000000000063', NULL, 'PRE_START', 1, 'IN_PROGRESS', 'dec0de00-0000-4000-8000-000000000004', '2026-09-09T01:00:00Z', NULL),
 ('dec0de00-0000-4000-8000-000000000079', 'dec0de00-0000-4000-8000-000000000027', 'dec0de00-0000-4000-8000-000000000064', NULL, 'WORK_DONE', 1, 'PENDING', NULL, NULL, NULL),
 ('dec0de00-0000-4000-8000-00000000007A', 'dec0de00-0000-4000-8000-000000000028', 'dec0de00-0000-4000-8000-000000000065', 'dec0de00-0000-4000-8000-000000000075', 'INSPECTION', 1, 'IN_PROGRESS', 'dec0de00-0000-4000-8000-000000000005', '2026-09-08T02:00:00Z', NULL),
 ('dec0de00-0000-4000-8000-00000000007B', 'dec0de00-0000-4000-8000-00000000002A', 'dec0de00-0000-4000-8000-000000000066', NULL, 'WORK_DONE', 1, 'COMPLETED', 'dec0de00-0000-4000-8000-000000000003', '2026-08-27T01:00:00Z', '2026-08-27T04:00:00Z'),
 ('dec0de00-0000-4000-8000-00000000007C', 'dec0de00-0000-4000-8000-000000000029', 'dec0de00-0000-4000-8000-000000000067', NULL, 'PRE_START', 1, 'COMPLETED', 'dec0de00-0000-4000-8000-000000000006', '2026-09-01T01:00:00Z', '2026-09-01T01:20:00Z')
ON CONFLICT DO NOTHING;

-- ── checklist_instance_items ─────────────────────────────────────────────
INSERT INTO checklist_instance_items (id, checklist_instance_id, source_template_item_id, sequence_no, title_snapshot, answer_type_snapshot, is_required_snapshot, is_blocking_snapshot, requires_photo_snapshot, answer_text, answer_number, answer_boolean, result, answered_by, answered_at)
VALUES
 ('dec0de00-0000-4000-8000-00000000007D', 'dec0de00-0000-4000-8000-000000000078', 'dec0de00-0000-4000-8000-000000000068', 1, N'Cốp pha kín khít, chống xê dịch', 'PASS_FAIL', TRUE, TRUE, TRUE, N'Đạt', NULL, NULL, 'PASS', 'dec0de00-0000-4000-8000-000000000004', '2026-09-09T02:00:00Z'),
 ('dec0de00-0000-4000-8000-00000000007E', 'dec0de00-0000-4000-8000-000000000078', 'dec0de00-0000-4000-8000-000000000069', 2, N'Độ sụt bê tông (cm)', 'NUMBER', TRUE, FALSE, FALSE, NULL, 12, NULL, 'PASS', 'dec0de00-0000-4000-8000-000000000004', '2026-09-09T02:10:00Z'),
 ('dec0de00-0000-4000-8000-00000000007F', 'dec0de00-0000-4000-8000-00000000007A', 'dec0de00-0000-4000-8000-00000000006B', 1, N'Ống luồn đúng tuyến bản vẽ', 'YES_NO', TRUE, TRUE, FALSE, NULL, NULL, NULL, NULL, NULL, NULL),
 ('dec0de00-0000-4000-8000-000000000080', 'dec0de00-0000-4000-8000-00000000007B', 'dec0de00-0000-4000-8000-00000000006A', 1, N'Bề mặt tường phẳng, không bong rộp', 'PASS_FAIL', TRUE, FALSE, TRUE, N'Đạt', NULL, NULL, 'PASS', 'dec0de00-0000-4000-8000-000000000003', '2026-08-27T03:00:00Z'),
 ('dec0de00-0000-4000-8000-000000000081', 'dec0de00-0000-4000-8000-00000000007C', 'dec0de00-0000-4000-8000-00000000006C', 1, N'Công nhân đội mũ bảo hộ', 'YES_NO', TRUE, TRUE, FALSE, NULL, NULL, TRUE, 'PASS', 'dec0de00-0000-4000-8000-000000000006', '2026-09-01T01:10:00Z'),
 ('dec0de00-0000-4000-8000-000000000082', 'dec0de00-0000-4000-8000-00000000007C', 'dec0de00-0000-4000-8000-00000000006D', 2, N'Ghi chú an toàn ca làm việc', 'TEXT', FALSE, FALSE, FALSE, N'Ca sáng đủ bảo hộ, dây đai đầy đủ', NULL, NULL, 'PASS', 'dec0de00-0000-4000-8000-000000000006', '2026-09-01T01:15:00Z')
ON CONFLICT DO NOTHING;

-- ── inspections ──────────────────────────────────────────────────────────
INSERT INTO inspections (id, checkpoint_id, work_order_id, checklist_instance_id, inspector_id, round_number, status, summary, started_at, completed_at)
VALUES
 ('dec0de00-0000-4000-8000-000000000083', 'dec0de00-0000-4000-8000-000000000073', 'dec0de00-0000-4000-8000-000000000024', NULL, 'dec0de00-0000-4000-8000-000000000003', 1, 'IN_PROGRESS', NULL, '2026-09-09T02:00:00Z', NULL),
 ('dec0de00-0000-4000-8000-000000000084', 'dec0de00-0000-4000-8000-000000000074', 'dec0de00-0000-4000-8000-000000000027', NULL, 'dec0de00-0000-4000-8000-000000000003', 1, 'PASS', N'Đợt 1 đạt: mạch đều, bề mặt phẳng', '2026-09-09T01:00:00Z', '2026-09-09T03:00:00Z'),
 ('dec0de00-0000-4000-8000-000000000085', 'dec0de00-0000-4000-8000-000000000075', 'dec0de00-0000-4000-8000-000000000028', 'dec0de00-0000-4000-8000-00000000007A', 'dec0de00-0000-4000-8000-000000000003', 1, 'FAIL', N'Không đạt: 2 tuyến ống chưa đúng cao độ thiết kế', '2026-09-08T02:00:00Z', '2026-09-08T05:00:00Z'),
 ('dec0de00-0000-4000-8000-000000000086', 'dec0de00-0000-4000-8000-000000000076', 'dec0de00-0000-4000-8000-00000000002A', NULL, 'dec0de00-0000-4000-8000-000000000003', 1, 'PASS', N'Lớp sơn lót đạt, cho phép sơn phủ', '2026-08-25T02:00:00Z', '2026-08-25T07:00:00Z'),
 ('dec0de00-0000-4000-8000-000000000087', 'dec0de00-0000-4000-8000-000000000077', 'dec0de00-0000-4000-8000-000000000029', NULL, 'dec0de00-0000-4000-8000-000000000003', 1, 'CONDITIONAL_PASS', N'Đạt có điều kiện: bổ sung biên bản tưới ẩm 2 ngày cuối', '2026-09-09T01:00:00Z', '2026-09-09T03:00:00Z')
ON CONFLICT DO NOTHING;

-- ── corrective_actions (assignee USER xor CREW) ───────────────────────────
INSERT INTO corrective_actions (id, inspection_id, checklist_instance_item_id, work_order_id, assignee_type, assigned_user_id, assigned_crew_id, title, description, severity, is_mandatory, due_at, status, submitted_at, verified_at, verified_by, resolution_note)
VALUES
 ('dec0de00-0000-4000-8000-000000000088', 'dec0de00-0000-4000-8000-000000000085', NULL, 'dec0de00-0000-4000-8000-000000000028', 'USER', 'dec0de00-0000-4000-8000-000000000004', NULL, N'Đi lại 2 tuyến ống sai cao độ', N'Đục chỉnh và đi lại ống khu B theo đúng cao độ bản vẽ MĐ-PT4', 'HIGH', TRUE, '2026-09-10T10:00:00Z', 'OPEN', NULL, NULL, NULL, NULL),
 ('dec0de00-0000-4000-8000-000000000089', 'dec0de00-0000-4000-8000-000000000085', NULL, 'dec0de00-0000-4000-8000-000000000028', 'CREW', NULL, 'dec0de00-0000-4000-8000-000000000010', N'Hỗ trợ hiệu chỉnh tuyến ống', N'Đội cơ điện cử 2 thợ phụ hỗ trợ đục và vệ sinh tuyến', 'MEDIUM', TRUE, '2026-09-10T10:00:00Z', 'IN_PROGRESS', NULL, NULL, NULL, NULL),
 ('dec0de00-0000-4000-8000-00000000008A', 'dec0de00-0000-4000-8000-000000000084', NULL, 'dec0de00-0000-4000-8000-000000000027', 'USER', 'dec0de00-0000-4000-8000-000000000005', NULL, N'Thay 3 viên gạch bể mạch', N'Thay 3 viên gạch bể tại ô K2-14, vệ sinh mạch', 'LOW', FALSE, '2026-09-10T10:00:00Z', 'VERIFIED', '2026-09-09T04:00:00Z', '2026-09-09T06:00:00Z', 'dec0de00-0000-4000-8000-000000000003', N'Đã thay và nghiệm thu đạt'),
 ('dec0de00-0000-4000-8000-00000000008B', 'dec0de00-0000-4000-8000-000000000087', NULL, 'dec0de00-0000-4000-8000-000000000029', 'USER', 'dec0de00-0000-4000-8000-000000000006', NULL, N'Bổ sung biên bản tưới ẩm', N'Hoàn thiện biên bản tưới ẩm 2 ngày cuối kèm hình ảnh', 'LOW', TRUE, '2026-09-10T10:00:00Z', 'SUBMITTED', '2026-09-09T05:00:00Z', NULL, NULL, NULL),
 ('dec0de00-0000-4000-8000-00000000008C', 'dec0de00-0000-4000-8000-000000000083', NULL, 'dec0de00-0000-4000-8000-000000000024', 'CREW', NULL, 'dec0de00-0000-4000-8000-00000000000E', N'Gia cố cốp pha trước hold point', N'Gia cố thêm chống tăng hàng biên trước khi gọi nghiệm thu', 'MEDIUM', TRUE, '2026-09-11T10:00:00Z', 'OPEN', NULL, NULL, NULL, NULL)
ON CONFLICT DO NOTHING;

-- ── attachments (storage_key duy nhất; project NOT NULL) ─────────────────
INSERT INTO attachments (id, project_id, work_order_id, owner_type, owner_id, attachment_type, uploaded_by, file_name, storage_key, mime_type, size_bytes, caption)
VALUES
 ('dec0de00-0000-4000-8000-00000000008D', 'dec0de00-0000-4000-8000-00000000001D', 'dec0de00-0000-4000-8000-000000000024', 'WORK_ORDER', 'dec0de00-0000-4000-8000-000000000024', 'PROGRESS_EVIDENCE', 'dec0de00-0000-4000-8000-000000000004', N'lap-dung-cop-pha.jpg', 'seed/00000000008D-lap-dung-cop-pha.jpg', 'image/jpeg', 245760, N'Hình lắp dựng cốp pha cột tầng 5'),
 ('dec0de00-0000-4000-8000-00000000008E', 'e2e4b000-0000-4000-8000-0000000000b1', 'dec0de00-0000-4000-8000-000000000028', 'WORK_ORDER', 'dec0de00-0000-4000-8000-000000000028', 'INSPECTION_EVIDENCE', 'dec0de00-0000-4000-8000-000000000003', N'tuyen-ong-dien.jpg', 'seed/00000000008E-tuyen-ong-dien.jpg', 'image/jpeg', 198656, N'Hình tuyến ống điện chờ nghiệm thu'),
 ('dec0de00-0000-4000-8000-00000000008F', 'dec0de00-0000-4000-8000-00000000001D', NULL, 'PROJECT', 'dec0de00-0000-4000-8000-00000000001D', 'DOCUMENT', '11111111-1111-4111-8111-111111111111', N'ban-ve-thap-a.pdf', 'seed/00000000008F-ban-ve-thap-a.pdf', 'application/pdf', 1048576, N'Bản vẽ kiến trúc tháp A'),
 ('dec0de00-0000-4000-8000-000000000090', 'e2e4b000-0000-4000-8000-0000000000b1', 'dec0de00-0000-4000-8000-000000000027', 'BLOCKER', 'dec0de00-0000-4000-8000-00000000005A', 'BLOCKER_EVIDENCE', 'dec0de00-0000-4000-8000-000000000005', N'thieu-tho-op-lat.jpg', 'seed/000000000090-thieu-tho.jpg', 'image/jpeg', 176128, N'Hình mặt bằng chờ thợ ốp lát'),
 ('dec0de00-0000-4000-8000-000000000091', 'dec0de00-0000-4000-8000-00000000001D', 'dec0de00-0000-4000-8000-00000000002A', 'CORRECTIVE_ACTION', 'dec0de00-0000-4000-8000-00000000008A', 'REWORK_EVIDENCE', 'dec0de00-0000-4000-8000-000000000004', N'thay-gach-be.jpg', 'seed/000000000091-thay-gach.jpg', 'image/jpeg', 210944, N'Hình thay gạch đã nghiệm thu')
ON CONFLICT DO NOTHING;

-- ── notifications ────────────────────────────────────────────────────────
INSERT INTO notifications (id, recipient_user_id, notification_type, title, content, entity_type, entity_id, is_read, read_at, dedup_key, expires_at)
VALUES
 ('dec0de00-0000-4000-8000-000000000092', 'dec0de00-0000-4000-8000-000000000004', N'WO_ASSIGNED', N'Bạn được gán việc ốp lát', N'Việc WO-PRD-101 đã được gán cho bạn', 'WORK_ORDER', 'dec0de00-0000-4000-8000-000000000027', FALSE, NULL, NULL, NULL),
 ('dec0de00-0000-4000-8000-000000000093', 'dec0de00-0000-4000-8000-000000000005', N'MATERIAL_SHORTAGE', N'Vật tư sắp hết', N'Gạch lát nền WO-PRD-101 còn 60/120 thùng', 'MATERIAL_SUPPLEMENT', 'dec0de00-0000-4000-8000-00000000005F', FALSE, NULL, NULL, '2026-09-16T00:00:00Z'),
 ('dec0de00-0000-4000-8000-000000000094', 'dec0de00-0000-4000-8000-000000000003', N'BLOCKER_OPENED', N'Blocker vật tư mới', N'Thiếu sơn chống thấm sàn hầm B1', 'BLOCKER', 'dec0de00-0000-4000-8000-000000000059', TRUE, '2026-09-08T06:00:00Z', NULL, NULL),
 ('dec0de00-0000-4000-8000-000000000095', 'dec0de00-0000-4000-8000-000000000006', N'INSPECTION_SCHEDULED', N'Lịch nghiệm thu bê tông', N'Hold point cốt thép WO-PRT-001 lúc 8 giờ sáng mai', 'INSPECTION', 'dec0de00-0000-4000-8000-000000000084', FALSE, NULL, 'seed-notif-000095', NULL),
 ('dec0de00-0000-4000-8000-000000000096', '22222222-2222-4222-8222-222222222222', N'DAILY_REPORT', N'Báo cáo ngày Thủ Thiêm', N'Tiến độ PRT ngày 09/09: 2 việc đang làm, 1 blocker mở', 'PROJECT', 'dec0de00-0000-4000-8000-00000000001D', FALSE, NULL, NULL, NULL)
ON CONFLICT DO NOTHING;

-- ── Guard cuối: bảng nghiệp vụ nào <5 mà KHÔNG thuộc ngoại lệ → FAIL ──────
-- Ngoại lệ có chủ ý: roles (4 role chuẩn RBAC — thêm là sai),
-- password_reset_tokens (token nhất thời do runtime tạo, không phải demo data),
-- schema_migrations (hệ thống migration), audit_logs (đã 4046, append-only).
DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(t, ', ' ORDER BY t) INTO bad FROM (
    SELECT 'assignments' t WHERE (SELECT count(*) FROM assignments) < 5
    UNION ALL SELECT 'attachments' WHERE (SELECT count(*) FROM attachments) < 5
    UNION ALL SELECT 'checklist_instance_items' WHERE (SELECT count(*) FROM checklist_instance_items) < 5
    UNION ALL SELECT 'checklist_instances' WHERE (SELECT count(*) FROM checklist_instances) < 5
    UNION ALL SELECT 'checklist_template_items' WHERE (SELECT count(*) FROM checklist_template_items) < 5
    UNION ALL SELECT 'checklist_templates' WHERE (SELECT count(*) FROM checklist_templates) < 5
    UNION ALL SELECT 'contractors' WHERE (SELECT count(*) FROM contractors) < 5
    UNION ALL SELECT 'corrective_actions' WHERE (SELECT count(*) FROM corrective_actions) < 5
    UNION ALL SELECT 'crew_members' WHERE (SELECT count(*) FROM crew_members) < 5
    UNION ALL SELECT 'crews' WHERE (SELECT count(*) FROM crews) < 5
    UNION ALL SELECT 'inspection_checkpoint_templates' WHERE (SELECT count(*) FROM inspection_checkpoint_templates) < 5
    UNION ALL SELECT 'inspection_checkpoints' WHERE (SELECT count(*) FROM inspection_checkpoints) < 5
    UNION ALL SELECT 'inspections' WHERE (SELECT count(*) FROM inspections) < 5
    UNION ALL SELECT 'material_supplement_requests' WHERE (SELECT count(*) FROM material_supplement_requests) < 5
    UNION ALL SELECT 'materials' WHERE (SELECT count(*) FROM materials) < 5
    UNION ALL SELECT 'notifications' WHERE (SELECT count(*) FROM notifications) < 5
    UNION ALL SELECT 'project_areas' WHERE (SELECT count(*) FROM project_areas) < 5
    UNION ALL SELECT 'project_members' WHERE (SELECT count(*) FROM project_members) < 5
    UNION ALL SELECT 'projects' WHERE (SELECT count(*) FROM projects) < 5
    UNION ALL SELECT 'readiness_check_items' WHERE (SELECT count(*) FROM readiness_check_items) < 5
    UNION ALL SELECT 'resource_trades' WHERE (SELECT count(*) FROM resource_trades) < 5
    UNION ALL SELECT 'trades' WHERE (SELECT count(*) FROM trades) < 5
    UNION ALL SELECT 'user_roles' WHERE (SELECT count(*) FROM user_roles) < 5
    UNION ALL SELECT 'users' WHERE (SELECT count(*) FROM users) < 5
    UNION ALL SELECT 'work_order_blockers' WHERE (SELECT count(*) FROM work_order_blockers) < 5
    UNION ALL SELECT 'work_order_dependencies' WHERE (SELECT count(*) FROM work_order_dependencies) < 5
    UNION ALL SELECT 'work_order_materials' WHERE (SELECT count(*) FROM work_order_materials) < 5
    UNION ALL SELECT 'work_order_readiness_checks' WHERE (SELECT count(*) FROM work_order_readiness_checks) < 5
    UNION ALL SELECT 'work_order_state_history' WHERE (SELECT count(*) FROM work_order_state_history) < 5
    UNION ALL SELECT 'work_order_updates' WHERE (SELECT count(*) FROM work_order_updates) < 5
    UNION ALL SELECT 'work_orders' WHERE (SELECT count(*) FROM work_orders) < 5
    UNION ALL SELECT 'work_types' WHERE (SELECT count(*) FROM work_types) < 5
    UNION ALL SELECT 'work_order_templates' WHERE (SELECT count(*) FROM work_order_templates) < 5
  ) s;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'seed guard: bảng chưa đủ 5 dòng: %', bad;
  END IF;
END
$$;

COMMIT;
