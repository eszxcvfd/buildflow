-- PRJ-SRS-002 E2E seed/cleanup (issue #33).
-- Throwaway E2E-only codes 'E2E2-%'. Audit giữ nguyên (append-only, guard cấm DELETE).
-- Cleanup: chạy đầu + cuối mỗi run.

DELETE FROM project_members WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'E2E2-%');
DELETE FROM attachments WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'E2E2-%');
DELETE FROM project_areas WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'E2E2-%');
DELETE FROM work_orders WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'E2E2-%');
DELETE FROM projects WHERE code LIKE 'E2E2-%';
