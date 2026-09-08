-- ============================================================================
-- BuildFlow demo data: work-order templates (2026-09-08).
--
-- 8 mẫu công việc thật (xây dựng Việt Nam, tiếng Việt tự nhiên) cho trang
-- /work-order-templates — trang đang trống sau driver cleanup.
--
-- HOW TO APPLY (live DB):
--   docker exec -i buildflow-postgres-1 psql -U buildflow -d buildflow \
--     < docs/evidence/demo-data/demo-work-order-templates.sql
--
-- IDEMPOTENT: INSERT ... ON CONFLICT (code) DO NOTHING — chạy lại an toàn.
--
-- GUARDS (không đụng row của evidence drivers PRJ-SRS-008):
--   * Chỉ INSERT code WOT-* mới (xem bảng dưới); KHÔNG UPDATE/DELETE.
--   * Không chạm các code driver: WOT-BE-TONG-COT, WOT-SON-TUONG,
--     WOT-E2E-BE-TONG, WOT-E2E-RONG (cleanup theo id do driver tự làm).
--   * work_type_id / required_trade_id resolve qua SELECT theo code
--     (work_types BT-CT/WT-*/trades OP-LAT/SON-NUOC/DIEN/THO-CAT) —
--     không hard-code uuid.
--   * Không chạm audit_logs (append-only), schema_migrations.
-- ============================================================================

-- 1. WOT-BT-COT — Đổ bê tông cột, vách (ACTIVE, HIGH)
INSERT INTO work_order_templates
  (code, name, description, work_type_id, required_trade_id,
   default_duration_minutes, default_priority, required_skills,
   checklist_snapshot, status, version)
SELECT
  'WOT-BT-COT', 'Đổ bê tông cột, vách',
  'Đổ bê tông cột và vách theo đúng mác thiết kế, đầm kỹ, bảo dưỡng ẩm liên tục 7 ngày sau đổ.',
  (SELECT id FROM work_types WHERE code = 'BT-CT'),
  (SELECT id FROM trades WHERE code = 'THO-CAT'),
  240, 'HIGH',
  '[{"code": "THO-CAT", "label": "Thợ cắt gạch, phụ bê tông"}]',
  '[{"title": "Nghiệm thu cốp pha, cốt thép trước khi đổ", "answerType": "PASS_FAIL", "isRequired": true, "isBlocking": true, "requiresPhoto": true, "sequenceNo": 1},
    {"title": "Mác bê tông và số xe thực tế", "answerType": "TEXT", "isRequired": true, "isBlocking": false, "requiresPhoto": false, "sequenceNo": 2},
    {"title": "Độ sụt đo tại hiện trường (cm)", "answerType": "NUMBER", "isRequired": true, "isBlocking": false, "requiresPhoto": false, "sequenceNo": 3},
    {"title": "Bảo dưỡng ẩm 7 ngày sau đổ", "answerType": "PASS_FAIL", "isRequired": true, "isBlocking": true, "requiresPhoto": true, "sequenceNo": 4}]',
  'ACTIVE', 1
ON CONFLICT (code) DO NOTHING;

-- 2. WOT-BT-SAN — Đổ bê tông dầm sàn thủ công (ACTIVE, NORMAL)
INSERT INTO work_order_templates
  (code, name, description, work_type_id, required_trade_id,
   default_duration_minutes, default_priority, required_skills,
   checklist_snapshot, status, version)
SELECT
  'WOT-BT-SAN', 'Đổ bê tông dầm sàn',
  'Đổ bê tông dầm sàn bằng thủ công hoặc bơm cần, làm phẳng mặt sàn và bảo dưỡng đúng quy trình.',
  (SELECT id FROM work_types WHERE code = 'WT-BE-TONG-TC'),
  (SELECT id FROM trades WHERE code = 'THO-CAT'),
  480, 'NORMAL',
  '[{"code": "THO-CAT", "label": "Thợ cắt gạch, phụ bê tông"}]',
  '[{"title": "Kiểm tra cao độ, cốp pha dầm sàn", "answerType": "PASS_FAIL", "isRequired": true, "isBlocking": true, "requiresPhoto": true, "sequenceNo": 1},
    {"title": "Khối lượng bê tông đã đổ (m3)", "answerType": "NUMBER", "isRequired": true, "isBlocking": false, "requiresPhoto": false, "sequenceNo": 2},
    {"title": "Ghi chú thời tiết lúc đổ", "answerType": "TEXT", "isRequired": false, "isBlocking": false, "requiresPhoto": false, "sequenceNo": 3},
    {"title": "Làm phẳng, xoa mặt sàn", "answerType": "PASS_FAIL", "isRequired": true, "isBlocking": true, "requiresPhoto": true, "sequenceNo": 4}]',
  'ACTIVE', 1
ON CONFLICT (code) DO NOTHING;

-- 3. WOT-COT-THEP — Gia công, lắp dựng cốt thép (ACTIVE, HIGH)
INSERT INTO work_order_templates
  (code, name, description, work_type_id, required_trade_id,
   default_duration_minutes, default_priority, required_skills,
   checklist_snapshot, status, version)
SELECT
  'WOT-COT-THEP', 'Gia công, lắp dựng cốt thép',
  'Cắt, uốn và buộc cốt thép đúng bản vẽ kết cấu, kê con kê bảo đảm lớp bảo vệ trước khi nghiệm thu.',
  (SELECT id FROM work_types WHERE code = 'BT-CT'),
  (SELECT id FROM trades WHERE code = 'THO-CAT'),
  360, 'HIGH',
  '[{"code": "THO-CAT", "label": "Thợ cắt gạch, phụ sắt"}]',
  '[{"title": "Đối chiếu chủng loại, đường kính thép với bản vẽ", "answerType": "PASS_FAIL", "isRequired": true, "isBlocking": true, "requiresPhoto": true, "sequenceNo": 1},
    {"title": "Số lượng thanh đã lắp (thanh)", "answerType": "NUMBER", "isRequired": true, "isBlocking": false, "requiresPhoto": false, "sequenceNo": 2},
    {"title": "Kê con kê, lớp bảo vệ đúng thiết kế", "answerType": "PASS_FAIL", "isRequired": true, "isBlocking": true, "requiresPhoto": true, "sequenceNo": 3}]',
  'ACTIVE', 1
ON CONFLICT (code) DO NOTHING;

-- 4. WOT-COP-PHA — Lắp dựng cốp pha (ACTIVE, NORMAL)
INSERT INTO work_order_templates
  (code, name, description, work_type_id, required_trade_id,
   default_duration_minutes, default_priority, required_skills,
   checklist_snapshot, status, version)
SELECT
  'WOT-COP-PHA', 'Lắp dựng cốp pha',
  'Lắp dựng cốp pha, chống tăng và kiểm tra độ kín khít, tim cốt trước khi bàn giao đổ bê tông.',
  (SELECT id FROM work_types WHERE code = 'BT-CT'),
  (SELECT id FROM trades WHERE code = 'THO-CAT'),
  300, 'NORMAL',
  '[{"code": "THO-CAT", "label": "Thợ cắt gạch, phụ cốp pha"}]',
  '[{"title": "Kiểm tra tim, cốt, độ thẳng đứng cốp pha", "answerType": "PASS_FAIL", "isRequired": true, "isBlocking": true, "requiresPhoto": true, "sequenceNo": 1},
    {"title": "Vệ sinh, quét dầu chống dính mặt ván", "answerType": "PASS_FAIL", "isRequired": true, "isBlocking": false, "requiresPhoto": false, "sequenceNo": 2},
    {"title": "Vị trí chờ, lỗ kỹ thuật còn thiếu", "answerType": "TEXT", "isRequired": false, "isBlocking": false, "requiresPhoto": false, "sequenceNo": 3}]',
  'ACTIVE', 1
ON CONFLICT (code) DO NOTHING;

-- 5. WOT-SON-NOI-THAT — Sơn nước tường nội thất (ACTIVE, NORMAL)
INSERT INTO work_order_templates
  (code, name, description, work_type_id, required_trade_id,
   default_duration_minutes, default_priority, required_skills,
   checklist_snapshot, status, version)
SELECT
  'WOT-SON-NOI-THAT', 'Sơn nước tường nội thất',
  'Bả matit, sơn lót 1 lớp và sơn phủ 2 lớp cho tường nội thất, nghiệm thu màu và độ phẳng.',
  (SELECT id FROM work_types WHERE code = 'WT-SON-NUOC'),
  (SELECT id FROM trades WHERE code = 'SON-NUOC'),
  240, 'NORMAL',
  '[{"code": "SON-NUOC", "label": "Thợ sơn nước"}]',
  '[{"title": "Kiểm tra bề mặt trước khi sơn", "answerType": "PASS_FAIL", "isRequired": true, "isBlocking": true, "requiresPhoto": true, "sequenceNo": 1},
    {"title": "Bả matit, xả nhám đạt phẳng", "answerType": "PASS_FAIL", "isRequired": true, "isBlocking": false, "requiresPhoto": false, "sequenceNo": 2},
    {"title": "Sơn lót 1 lớp, sơn phủ 2 lớp", "answerType": "PASS_FAIL", "isRequired": true, "isBlocking": false, "requiresPhoto": true, "sequenceNo": 3},
    {"title": "Mã màu sơn sử dụng", "answerType": "TEXT", "isRequired": true, "isBlocking": false, "requiresPhoto": false, "sequenceNo": 4},
    {"title": "Nghiệm thu màu, không loang lổ", "answerType": "PASS_FAIL", "isRequired": true, "isBlocking": true, "requiresPhoto": true, "sequenceNo": 5}]',
  'ACTIVE', 1
ON CONFLICT (code) DO NOTHING;

-- 6. WOT-OP-LAT-NEN — Ốp lát gạch nền (ACTIVE, NORMAL)
INSERT INTO work_order_templates
  (code, name, description, work_type_id, required_trade_id,
   default_duration_minutes, default_priority, required_skills,
   checklist_snapshot, status, version)
SELECT
  'WOT-OP-LAT-NEN', 'Ốp lát gạch nền',
  'Cán nền, ốp lát gạch đúng ron, cao độ và độ dốc thoát nước, vệ sinh bàn giao.',
  (SELECT id FROM work_types WHERE code = 'WT-OP-LAT'),
  (SELECT id FROM trades WHERE code = 'OP-LAT'),
  300, 'NORMAL',
  '[{"code": "OP-LAT", "label": "Thợ ốp lát"}]',
  '[{"title": "Kiểm tra cao độ, độ dốc thoát nước", "answerType": "PASS_FAIL", "isRequired": true, "isBlocking": true, "requiresPhoto": false, "sequenceNo": 1},
    {"title": "Diện tích đã lát (m2)", "answerType": "NUMBER", "isRequired": true, "isBlocking": false, "requiresPhoto": false, "sequenceNo": 2},
    {"title": "Ron gạch đều, không bộp", "answerType": "PASS_FAIL", "isRequired": true, "isBlocking": true, "requiresPhoto": true, "sequenceNo": 3},
    {"title": "Vệ sinh, bàn giao mặt bằng", "answerType": "PASS_FAIL", "isRequired": true, "isBlocking": false, "requiresPhoto": true, "sequenceNo": 4}]',
  'ACTIVE', 1
ON CONFLICT (code) DO NOTHING;

-- 7. WOT-DIEN-AM — Đi ống điện âm tường (ACTIVE, HIGH)
INSERT INTO work_order_templates
  (code, name, description, work_type_id, required_trade_id,
   default_duration_minutes, default_priority, required_skills,
   checklist_snapshot, status, version)
SELECT
  'WOT-DIEN-AM', 'Đi ống điện âm tường',
  'Cắt tường, đi ống ruột gà, kéo dây và lắp đế âm đúng sơ đồ điện, thử thông mạch trước khi tô trát.',
  (SELECT id FROM work_types WHERE code = 'WT-DIEN'),
  (SELECT id FROM trades WHERE code = 'DIEN'),
  240, 'HIGH',
  '[{"code": "DIEN", "label": "Thợ điện công trình"}]',
  '[{"title": "Đánh dấu tuyến ống theo sơ đồ", "answerType": "PASS_FAIL", "isRequired": true, "isBlocking": false, "requiresPhoto": false, "sequenceNo": 1},
    {"title": "Số mét ống đã đi (m)", "answerType": "NUMBER", "isRequired": true, "isBlocking": false, "requiresPhoto": false, "sequenceNo": 2},
    {"title": "Kéo dây, thử thông mạch đạt", "answerType": "PASS_FAIL", "isRequired": true, "isBlocking": true, "requiresPhoto": true, "sequenceNo": 3},
    {"title": "Chụp ảnh tuyến ống trước khi tô", "answerType": "PASS_FAIL", "isRequired": true, "isBlocking": true, "requiresPhoto": true, "sequenceNo": 4}]',
  'ACTIVE', 1
ON CONFLICT (code) DO NOTHING;

-- 8. WOT-CHONG-THAM — Chống thấm sàn vệ sinh (DRAFT — thể hiện vòng đời)
INSERT INTO work_order_templates
  (code, name, description, work_type_id, required_trade_id,
   default_duration_minutes, default_priority, required_skills,
   checklist_snapshot, status, version)
SELECT
  'WOT-CHONG-THAM', 'Chống thấm sàn vệ sinh',
  'Bản nháp: vệ sinh, quét chống thấm 2 lớp và ngâm thử nước 48 giờ cho sàn vệ sinh trước khi ốp lát (chờ rà soát định mức).',
  (SELECT id FROM work_types WHERE code = 'WT-OP-LAT'),
  (SELECT id FROM trades WHERE code = 'OP-LAT'),
  360, 'NORMAL',
  '[{"code": "OP-LAT", "label": "Thợ ốp lát"}, {"code": "SON-NUOC", "label": "Thợ sơn nước"}]',
  '[{"title": "Vệ sinh, xử lý cổ ống xuyên sàn", "answerType": "PASS_FAIL", "isRequired": true, "isBlocking": true, "requiresPhoto": true, "sequenceNo": 1},
    {"title": "Quét chống thấm 2 lớp đúng định mức", "answerType": "PASS_FAIL", "isRequired": true, "isBlocking": false, "requiresPhoto": true, "sequenceNo": 2},
    {"title": "Ngâm thử nước 48 giờ, ghi nhận mực nước", "answerType": "TEXT", "isRequired": true, "isBlocking": true, "requiresPhoto": true, "sequenceNo": 3}]',
  'DRAFT', 1
ON CONFLICT (code) DO NOTHING;

-- --------------------------------------------------------------------------
-- Verification (expect 8 / 7 / 1):
--   SELECT count(*) FROM work_order_templates; -- 8
--   SELECT status, count(*) FROM work_order_templates GROUP BY status;
--   SELECT code FROM work_order_templates
--     WHERE code ~* 'e2e|probe|test'; -- 0 rows
-- --------------------------------------------------------------------------
