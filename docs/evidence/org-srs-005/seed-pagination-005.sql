-- ORG-SRS-005 (#28) pagination seed — 20 WORKER users realistic cho dataset >20.
-- Theo docs/demo-data.md (chuẩn hóa 2026-09-07): tên Việt + email @vinacons.vn +
-- mã TX-8xx (dải mã run, không đụng mã canonical TX-00xx). Password = hash dùng
-- chung của thang.nguyen@vinacons.vn (tức E2EWorker@2025). Idempotent theo
-- lower(email). Cleanup id-based theo ids đã ghi (xem e2e-vars-pagination.json)
-- + fallback mã TX-8% trong cửa sổ created_at (xem ORG-SRS-005-E2E.md §10.3).
-- audit_logs: seed SQL trực tiếp nên KHÔNG sinh audit row (đã verify = 0).
--
-- Chạy:
--   docker exec -i buildflow-postgres-1 psql -U buildflow -d buildflow \
--     < docs/evidence/org-srs-005/seed-pagination-005.sql

WITH seed(full_name, email, code) AS (VALUES
  ('Hoàng Văn An',   'an.hoang.01@vinacons.vn',   'TX-801'),
  ('Vũ Văn Bình',    'binh.vu.02@vinacons.vn',    'TX-802'),
  ('Đặng Văn Chiến', 'chien.dang.03@vinacons.vn', 'TX-803'),
  ('Bùi Văn Dũng',   'dung.bui.04@vinacons.vn',   'TX-804'),
  ('Phan Văn Giang', 'giang.phan.05@vinacons.vn', 'TX-805'),
  ('Vũ Văn Hải',     'hai.vu.06@vinacons.vn',     'TX-806'),
  ('Đinh Văn Hùng',  'hung.dinh.07@vinacons.vn',  'TX-807'),
  ('Phạm Văn Kiên',  'kien.pham.08@vinacons.vn',  'TX-808'),
  ('Hoàng Văn Long', 'long.hoang.09@vinacons.vn', 'TX-809'),
  ('Trần Văn Minh',  'minh.tran.10@vinacons.vn',  'TX-810'),
  ('Lê Văn Nam',     'nam.le.11@vinacons.vn',     'TX-811'),
  ('Đỗ Văn Phong',   'phong.do.12@vinacons.vn',   'TX-812'),
  ('Nguyễn Văn Quang','quang.nguyen.13@vinacons.vn','TX-813'),
  ('Trần Văn Sơn',   'son.tran.14@vinacons.vn',   'TX-814'),
  ('Phạm Văn Tài',   'tai.pham.15@vinacons.vn',   'TX-815'),
  ('Nguyễn Văn Vinh','vinh.nguyen.16@vinacons.vn','TX-816'),
  ('Trần Văn Xuân',  'xuan.tran.17@vinacons.vn',  'TX-817'),
  ('Lê Văn Yên',     'yen.le.18@vinacons.vn',     'TX-818'),
  ('Bùi Văn Bảo',    'bao.bui.19@vinacons.vn',    'TX-819'),
  ('Đinh Văn Công',  'cong.dinh.20@vinacons.vn',  'TX-820')
)
INSERT INTO users (email, password_hash, full_name, employee_code, user_type, status)
SELECT s.email,
       (SELECT password_hash FROM users WHERE email = 'thang.nguyen@vinacons.vn'),
       s.full_name, s.code, 'WORKER', 'ACTIVE'
FROM seed s
ON CONFLICT ((lower(email))) DO NOTHING;

-- role WORKER (roles.code='WORKER'), idempotent
INSERT INTO user_roles (user_id, role_id, is_active)
SELECT u.id, (SELECT id FROM roles WHERE code = 'WORKER'), true
FROM users u
WHERE u.employee_code LIKE 'TX-8%'
  AND NOT EXISTS (SELECT 1 FROM user_roles ur
                  WHERE ur.user_id = u.id
                    AND ur.role_id = (SELECT id FROM roles WHERE code = 'WORKER')
                    AND ur.is_active);

-- Xác nhận seed
SELECT 'users_TX-8' AS t, count(*) FROM users WHERE employee_code LIKE 'TX-8%';

-- ============ CLEANUP id-based (chạy SAU khi run pagination xong; audit_logs giữ nguyên) ============
-- -- Cách 1 (chính): xóa theo ids đã ghi trong e2e-vars-pagination.json:
-- --   DELETE FROM user_roles WHERE user_id IN (<ids...>);
-- --   DELETE FROM users WHERE id IN (<ids...>);
-- -- Cách 2 (fallback): mã run TX-8% trong cửa sổ 12h:
-- --   DELETE FROM user_roles WHERE user_id IN
-- --     (SELECT id FROM users WHERE employee_code LIKE 'TX-8%' AND created_at > now() - interval '12 hours');
-- --   DELETE FROM users WHERE employee_code LIKE 'TX-8%' AND created_at > now() - interval '12 hours';
