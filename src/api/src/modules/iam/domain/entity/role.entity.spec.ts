import { RoleEntity } from './role.entity';

describe('RoleEntity IAM-SRS-005', () => {
  it('active role is assignable', () => {
    const role = new RoleEntity({
      id: 'r1',
      code: 'ADMIN',
      name: 'Admin',
      isSystem: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(role.isAssignable()).toBe(true);
  });

  it('inactive role is not assignable', () => {
    const role = new RoleEntity({
      id: 'r2',
      code: 'LEGACY',
      name: 'Legacy',
      isSystem: false,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(role.isAssignable()).toBe(false);
  });
});
