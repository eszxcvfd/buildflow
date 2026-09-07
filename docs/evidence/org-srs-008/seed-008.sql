-- ORG-SRS-008 E2E seed: capability trade (THO-CAT) cho crew DXT-01 ('Đội xây tô số 1').
-- Worker zero-trade / skill-3 + crew tạo qua API trong driver (cần id trả về);
-- chỉ phần resource_trades của crew phải chèn SQL (không có API công khai).
-- Idempotent theo cặp (crew_id, trade_id). Cleanup id-based trong driver
-- (ids trong e2e-vars.json + sweep identities + fallback created_at 12h).
-- audit_logs giữ nguyên (INSERT này không sinh audit).

INSERT INTO resource_trades (resource_type, crew_id, trade_id, skill_level, effective_from, is_active)
SELECT 'CREW', c.id, t.id, 3, CURRENT_DATE, true
FROM crews c, trades t
WHERE c.code = 'DXT-01' AND t.code = 'THO-CAT'
ON CONFLICT DO NOTHING;
