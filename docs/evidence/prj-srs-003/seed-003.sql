-- PRJ-SRS-003 E2E seed/cleanup (issue #34).
-- Throwaway E2E-only codes 'E2E3-%'. Audit giữ nguyên (append-only, guard cấm DELETE).
-- Cleanup: chạy đầu + cuối mỗi run.

DELETE FROM work_orders WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'E2E3-%');
DELETE FROM attachments WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'E2E3-%');
DELETE FROM project_areas WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'E2E3-%');
DELETE FROM project_members WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'E2E3-%');
DELETE FROM projects WHERE code LIKE 'E2E3-%';
