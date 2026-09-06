-- ORG-SRS-007 E2E seed: 2 WORKER users (worker3/worker4) cho double-submit + PM flow.
-- Password = copy hash của worker1 (E2EWorker@2025). Chạy 1 lần trước driver (idempotent).
-- Cleanup ở cuối driver xóa 2 users này + crews/members E2E7; audit_logs giữ nguyên.

INSERT INTO users (id, email, password_hash, full_name, user_type, status)
SELECT '55555555-5555-4555-8555-555555555555', 'worker3@example.com', password_hash, 'E2E Worker Three', 'WORKER', 'ACTIVE'
FROM users WHERE email = 'worker1@example.com'
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, password_hash, full_name, user_type, status)
SELECT '66666666-6666-4666-8666-666666666666', 'worker4@example.com', password_hash, 'E2E Worker Four', 'WORKER', 'ACTIVE'
FROM users WHERE email = 'worker1@example.com'
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id, is_active)
VALUES
  ('55555555-5555-4555-8555-555555555555', 'a0000000-0000-4000-8000-000000000003', true),
  ('66666666-6666-4666-8666-666666666666', 'a0000000-0000-4000-8000-000000000003', true)
ON CONFLICT DO NOTHING;
