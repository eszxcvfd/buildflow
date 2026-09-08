-- Seed PRJ-SRS-008 (#39) — Mẫu công việc (evidence-only).
-- Tái chạy an toàn (ON CONFLICT DO NOTHING). Cleanup theo id trong driver
-- (audit giữ nguyên, append-only). Không đụng dữ liệu canonical.
--
-- Dùng work type + trades THẬT đang ACTIVE:
--   work type BT-CT 'Công tác bê tông cốt thép' (e2e4b200-...)
--   trade OP-LAT 'Thợ ốp lát' (b017178a-...), skill code DIEN 'Thợ điện' (active)
-- + 1 trade INACTIVE seed riêng cho M7 (validation trade ngừng hoạt động).
-- + 2 templates mẫu tiếng Việt: 1 ACTIVE + 1 DRAFT.

-- M7: trade ngừng hoạt động (không hiện trong picker ACTIVE của UI).
INSERT INTO trades (id, code, name, description, is_active)
VALUES
  ('c8000001-0001-4000-8000-000000000001', 'THO-NGUNG-KS', 'Thợ ngừng khảo sát',
   'Seed E2E PRJ-SRS-008 (#39): trade INACTIVE phục vụ kiểm thử validation (M7).', false)
ON CONFLICT DO NOTHING;

-- Template mẫu 1: ACTIVE — 'Đổ bê tông cột chuẩn'.
INSERT INTO work_order_templates
  (id, code, name, description, work_type_id, required_trade_id,
   default_duration_minutes, default_priority, required_skills,
   checklist_snapshot, source_checklist_template_id, status, version)
VALUES
  ('c80000a1-0001-4000-8000-000000000001', 'WOT-BE-TONG-COT', 'Đổ bê tông cột chuẩn',
   'Mẫu đổ bê tông cột: kiểm tra cốp pha, đổ đúng mác, bảo dưỡng sau đổ (đợt T9/2026).',
   'e2e4b200-0000-4000-8000-0000000000b3', 'b017178a-daf2-4614-ac34-a05e1d1a6fb7',
   180, 'HIGH',
   '[{"code": "DIEN", "label": "Thợ điện công trình"}]',
   '[{"title": "Kiểm tra cốp pha, cốt thép trước khi đổ", "answerType": "YES_NO", "isRequired": true, "isBlocking": true, "requiresPhoto": true, "sequenceNo": 1},
     {"title": "Ghi nhận mác bê tông và số xe", "answerType": "TEXT", "isRequired": true, "isBlocking": false, "requiresPhoto": false, "sequenceNo": 2},
     {"title": "Bảo dưỡng sau đổ 7 ngày", "answerType": "PASS_FAIL", "isRequired": true, "isBlocking": true, "requiresPhoto": true, "sequenceNo": 3}]',
   NULL, 'ACTIVE', 1)
ON CONFLICT DO NOTHING;

-- Template mẫu 2: DRAFT — 'Sơn tường hoàn thiện'.
INSERT INTO work_order_templates
  (id, code, name, description, work_type_id, required_trade_id,
   default_duration_minutes, default_priority, required_skills,
   checklist_snapshot, source_checklist_template_id, status, version)
VALUES
  ('c80000a1-0002-4000-8000-000000000002', 'WOT-SON-TUONG', 'Sơn tường hoàn thiện',
   'Mẫu sơn tường: vệ sinh bề mặt, sơn lót, sơn phủ 2 lớp (bản nháp chờ rà soát).',
   'e2e4b200-0000-4000-8000-0000000000b3', 'b017178a-daf2-4614-ac34-a05e1d1a6fb7',
   120, 'NORMAL',
   '[{"code": "OP-LAT", "label": "Thợ ốp lát hoàn thiện"}]',
   '[{"title": "Vệ sinh, xử lý bề mặt tường", "answerType": "YES_NO", "isRequired": true, "isBlocking": false, "requiresPhoto": false, "sequenceNo": 1},
     {"title": "Sơn lót 1 lớp", "answerType": "YES_NO", "isRequired": true, "isBlocking": false, "requiresPhoto": false, "sequenceNo": 2},
     {"title": "Sơn phủ 2 lớp, nghiệm thu màu", "answerType": "PASS_FAIL", "isRequired": true, "isBlocking": true, "requiresPhoto": true, "sequenceNo": 3}]',
   NULL, 'DRAFT', 1)
ON CONFLICT DO NOTHING;
