import { canManageProjects } from './roles';

describe('web role helpers PRJ-SRS-001 (issue #32)', () => {
  it('canManageProjects true cho ADMIN + PROJECT_MANAGER (hoa/thường)', () => {
    expect(canManageProjects(['ADMIN'])).toBe(true);
    expect(canManageProjects(['PROJECT_MANAGER'])).toBe(true);
    expect(canManageProjects(['project_manager'])).toBe(true);
    expect(canManageProjects(['WORKER', 'PROJECT_MANAGER'])).toBe(true);
  });

  it('canManageProjects fail-closed: rỗng, WORKER, alias project_role, role lạ', () => {
    expect(canManageProjects([])).toBe(false);
    expect(canManageProjects(['WORKER'])).toBe(false);
    expect(canManageProjects(['MANAGER'])).toBe(false);
    expect(canManageProjects(['COORDINATOR'])).toBe(false);
    expect(canManageProjects(['PM'])).toBe(false);
    expect(canManageProjects(['SYSTEM_ADMIN'])).toBe(false);
  });
});
