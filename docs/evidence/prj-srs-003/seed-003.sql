-- PRJ-SRS-003 E2E seed/cleanup (issue #34).
-- Throwaway E2E-only codes 'VDA3-%'. Audit giữ nguyên (append-only, guard cấm DELETE).
-- Cleanup: chạy đầu + cuối mỗi run. Driver xóa id-based trước (ids trong
-- e2e-vars.json); bên dưới là prefix + cửa sổ 12h fallback. Re-runnable.

DELETE FROM work_orders WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'VDA3-%');
DELETE FROM attachments WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'VDA3-%');
DELETE FROM project_areas WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'VDA3-%');
DELETE FROM project_members WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'VDA3-%');
DELETE FROM projects WHERE code LIKE 'VDA3-%';
-- Fallback: run rows trong 12h qua.
DELETE FROM work_orders WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'VDA3-%' AND created_at > now() - interval '12 hours');
DELETE FROM attachments WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'VDA3-%' AND created_at > now() - interval '12 hours');
DELETE FROM project_areas WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'VDA3-%' AND created_at > now() - interval '12 hours');
DELETE FROM project_members WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'VDA3-%' AND created_at > now() - interval '12 hours');
DELETE FROM projects WHERE code LIKE 'VDA3-%' AND created_at > now() - interval '12 hours';
