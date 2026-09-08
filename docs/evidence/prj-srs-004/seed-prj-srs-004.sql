-- PRJ-SRS-004 E2E seed (issue #35) — catalog loại công việc demo.
-- ADR-0003 (realistic data): tên tiếng Việt kiểu doanh nghiệp, mã suffix tự
-- nhiên, KHÔNG dùng E2E%/test% trong dữ liệu hiển thị.
-- Re-runnable: INSERT ... ON CONFLICT (code) DO NOTHING — chạy lại an toàn,
-- KHÔNG reset is_active/config_version (giữ trạng thái do driver tạo ra).
-- Fixed UUID để driver cleanup chính xác; seed KHÔNG bị driver xóa.
--
-- 4 dòng seed:
--   1. WT-SON-NUOC 'Thi công sơn nước' (Hoàn thiện, trade SON-NUOC, ACTIVE)
--   2. WT-DIEN      'Lắp đặt điện' (Cơ điện, trade DIEN, ACTIVE)
--   3. WT-OP-LAT    'Thi công ốp lát' (Hoàn thiện, trade OP-LAT, ACTIVE)
--   4. WT-BE-TONG-TC 'Đổ bê tông thủ công' (Kết cấu, không trade) —
--      seed ở ACTIVE; driver setup DEACTIVATE qua API để có audit lịch sử
--      thật (PRJ_WORK_TYPE_STATUS_CHANGED), sau đó giữ INACTIVE.

INSERT INTO work_types (id, code, name, description, work_type_group, required_trade_id, required_fields, config_version, is_active)
VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'WT-SON-NUOC', 'Thi công sơn nước',
   'Sơn nước nội ngoại thất: bả matit, sơn lót, sơn phủ theo định mức hãng',
   'Hoàn thiện',
   (SELECT id FROM trades WHERE code = 'SON-NUOC'),
   '[{"key":"dien_tich","label":"Diện tích (m²)","type":"NUMBER"},{"key":"so_tang","label":"Số tầng","type":"NUMBER"}]',
   1, true),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'WT-DIEN', 'Lắp đặt điện',
   'Đi dây, lắp công tắc ổ cắm và đèn chiếu sáng cho căn hộ',
   'Cơ điện',
   (SELECT id FROM trades WHERE code = 'DIEN'),
   '[{"key":"so_diem_dien","label":"Số điểm điện","type":"NUMBER"},{"key":"anh_ban_ve","label":"Ảnh bản vẽ hoàn công","type":"PHOTO"}]',
   1, true),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'WT-OP-LAT', 'Thi công ốp lát',
   'Ốp lát gạch nền và tường khu vệ sinh, ban công',
   'Hoàn thiện',
   (SELECT id FROM trades WHERE code = 'OP-LAT'),
   '[{"key":"dien_tich","label":"Diện tích (m²)","type":"NUMBER"},{"key":"anh_nghiem_thu","label":"Ảnh nghiệm thu","type":"PHOTO"}]',
   1, true),
  ('a1b2c3d4-0004-4000-8000-000000000004', 'WT-BE-TONG-TC', 'Đổ bê tông thủ công',
   'Bê tông trộn tay cho cấu kiện nhỏ lẻ, khối lượng dưới 2m³',
   'Kết cấu',
   NULL,
   '[{"key":"khoi_luong","label":"Khối lượng (m³)","type":"NUMBER"}]',
   1, true)
ON CONFLICT (code) DO NOTHING;
