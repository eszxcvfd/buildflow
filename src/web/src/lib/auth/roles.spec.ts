import { hasAdminRole, canViewResourceDirectory, isAdminCode, isProjectManagerCode } from './roles';

describe('web role helpers ORG-SRS-005 (issue #28)', () => {
  it('isAdminCode chỉ nhận ADMIN thật (roles.code trong DB, hoa/thường)', () => {
    expect(isAdminCode('ADMIN')).toBe(true);
    expect(isAdminCode('admin')).toBe(true);
    expect(isAdminCode('SYSTEM_ADMIN')).toBe(false);
    expect(isAdminCode('ADMINISTRATOR')).toBe(false);
    expect(isAdminCode('PROJECT_MANAGER')).toBe(false);
    expect(isAdminCode('WORKER')).toBe(false);
  });

  it('isProjectManagerCode chỉ nhận PROJECT_MANAGER thật — không alias project_role', () => {
    expect(isProjectManagerCode('PROJECT_MANAGER')).toBe(true);
    expect(isProjectManagerCode('project_manager')).toBe(true);
    expect(isProjectManagerCode('PM')).toBe(false);
    expect(isProjectManagerCode('MANAGER')).toBe(false);
    expect(isProjectManagerCode('COORDINATOR')).toBe(false);
    expect(isProjectManagerCode('ADMIN')).toBe(false);
  });

  it('hasAdminRole chỉ true khi có code admin', () => {
    expect(hasAdminRole(['ADMIN'])).toBe(true);
    expect(hasAdminRole(['PROJECT_MANAGER'])).toBe(false);
    expect(hasAdminRole([])).toBe(false);
  });

  it('canViewResourceDirectory true cho ADMIN + PROJECT_MANAGER, false cho role khác', () => {
    expect(canViewResourceDirectory(['ADMIN'])).toBe(true);
    expect(canViewResourceDirectory(['PROJECT_MANAGER'])).toBe(true);
    expect(canViewResourceDirectory(['WORKER'])).toBe(false);
    expect(canViewResourceDirectory([])).toBe(false);
    expect(canViewResourceDirectory(['WORKER', 'PROJECT_MANAGER'])).toBe(true);
  });

  it('canViewResourceDirectory false cho alias project_role và role lạ (fail-closed nav)', () => {
    expect(canViewResourceDirectory(['MANAGER'])).toBe(false);
    expect(canViewResourceDirectory(['COORDINATOR'])).toBe(false);
    expect(canViewResourceDirectory(['PM'])).toBe(false);
    expect(canViewResourceDirectory(['SYSTEM_ADMIN'])).toBe(false);
    expect(canViewResourceDirectory(['STAFF'])).toBe(false);
    expect(canViewResourceDirectory(['RANDOM_CODE'])).toBe(false);
  });
});
