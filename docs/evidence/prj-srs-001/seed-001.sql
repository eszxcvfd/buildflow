-- PRJ-SRS-001 E2E seed/cleanup (issue #32).
-- Throwaway E2E-only codes 'E2E1-%'. Audit giữ nguyên (append-only).
-- Cleanup: chạy đầu + cuối mỗi run.

DELETE FROM project_members WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'E2E1-%');
DELETE FROM attachments WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'E2E1-%');
DELETE FROM project_areas WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'E2E1-%');
DELETE FROM work_orders WHERE project_id IN (SELECT id FROM projects WHERE code LIKE 'E2E1-%');
DELETE FROM projects WHERE code LIKE 'E2E1-%';
