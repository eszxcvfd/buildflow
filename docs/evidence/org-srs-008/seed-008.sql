-- ORG-SRS-008 E2E seed: capability trade (THO-CAT) cho crew E2E8-CREW.
-- Worker zero-trade / skill-3 + crew tạo qua API trong driver (cần id trả về);
-- chỉ phần resource_trades của crew phải chèn SQL (không có API công khai).
-- Idempotent theo cặp (crew_id, trade_id). Cleanup ở cuối driver.
-- audit_logs giữ nguyên (INSERT này không sinh audit).

INSERT INTO resource_trades (resource_type, crew_id, trade_id, skill_level, effective_from, is_active)
SELECT 'CREW', c.id, t.id, 3, CURRENT_DATE, true
FROM crews c, trades t
WHERE c.code = 'E2E8-CREW' AND t.code = 'THO-CAT'
ON CONFLICT DO NOTHING;
