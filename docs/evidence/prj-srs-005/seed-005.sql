-- PRJ-SRS-005 E2E seed/cleanup (issue #36).
-- Throwaway E2E-only codes 'VDA5-%'. Audit giữ nguyên (append-only, guard cấm DELETE).
-- Cleanup: chạy đầu + cuối mỗi run. Driver xóa id-based trước (ids trong
-- e2e-vars.json); bên dưới là prefix + cửa sổ 12h fallback. Re-runnable.
-- Canonical PRA/PRB/PRC/PRD không bị đụng (khác prefix, cũ hơn 12h).

DELETE FROM project_members WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'VDA5-%');
DELETE FROM attachments WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'VDA5-%');
DELETE FROM project_areas WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'VDA5-%');
DELETE FROM work_orders WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'VDA5-%');
DELETE FROM projects WHERE code LIKE 'VDA5-%';
-- Fallback: run rows trong 12h qua (bắt sót khi code lệch prefix vì nhập tay).
DELETE FROM project_members WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'VDA5-%' AND created_at > now() - interval '12 hours');
DELETE FROM attachments WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'VDA5-%' AND created_at > now() - interval '12 hours');
DELETE FROM project_areas WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'VDA5-%' AND created_at > now() - interval '12 hours');
DELETE FROM work_orders WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'VDA5-%' AND created_at > now() - interval '12 hours');
DELETE FROM projects WHERE code LIKE 'VDA5-%' AND created_at > now() - interval '12 hours';
