-- ORG-SRS-007 E2E seed: 2 WORKER users (worker3/worker4) cho double-submit + PM flow.
-- Theo docs/demo-data.md (chuẩn hóa 2026-09-07): tên Việt + email @vinacons.vn.
-- Password = copy hash của thang.nguyen@vinacons.vn (tức E2EWorker@2025).
-- Idempotent theo id (ON CONFLICT DO NOTHING). Cleanup id-based trong driver
-- cuối mỗi run (ids trong e2e-vars.json) + pre-cleanup run trước; audit_logs giữ nguyên.

INSERT INTO users (id, email, password_hash, full_name, user_type, status)
SELECT '55555555-5555-4555-8555-555555555555', 'duc.tran@vinacons.vn', password_hash, 'Trần Minh Đức', 'WORKER', 'ACTIVE'
FROM users WHERE email = 'thang.nguyen@vinacons.vn'
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, password_hash, full_name, user_type, status)
SELECT '66666666-6666-4666-8666-666666666666', 'son.le@vinacons.vn', password_hash, 'Lê Văn Sơn', 'WORKER', 'ACTIVE'
FROM users WHERE email = 'thang.nguyen@vinacons.vn'
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id, is_active)
VALUES
  ('55555555-5555-4555-8555-555555555555', 'a0000000-0000-4000-8000-000000000003', true),
  ('66666666-6666-4666-8666-666666666666', 'a0000000-0000-4000-8000-000000000003', true)
ON CONFLICT DO NOTHING;
