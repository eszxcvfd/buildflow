import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GetUserRolesUseCase } from './get-user-roles.use-case';
import { UserEntity } from '../../domain/entity/user.entity';

function makeUser(id = 'user-1'): UserEntity {
  return new UserEntity({
    id,
    email: 'a@b.com',
    passwordHash: 'h',
    fullName: 'A',
    status: 'ACTIVE',
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    userType: 'STAFF',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ReturnType<UserEntity['getProps']>);
}

describe('GetUserRolesUseCase IAM-SRS-005', () => {
  it('ADMIN có thể xem roles của user', async () => {
    const userRepo = {
      findById: jest.fn(async () => makeUser()),
      findActiveRolesByUserId: jest.fn(async () => [{ id: 'r1', code: 'WORKER', name: 'Worker' }]),
    } as unknown as never;
    const roleRepo = {
      findActiveRolesByUserId: jest.fn(async () => [{ id: 'r1', code: 'WORKER', name: 'Worker' }]),
    } as unknown as never;
    const uc = new GetUserRolesUseCase(userRepo, roleRepo);
    const out = await uc.execute({ targetUserId: 'user-1', actorUserId: 'admin-1', actorRoles: ['ADMIN'] });
    expect(out.roles).toHaveLength(1);
    expect(out.effectivePolicy).toContain('NEXT_LOGIN');
  });

  it('non-ADMIN bị Forbidden server-side', async () => {
    const userRepo = { findById: jest.fn(async () => makeUser()) } as unknown as never;
    const roleRepo = { findActiveRolesByUserId: jest.fn(async () => []) } as unknown as never;
    const uc = new GetUserRolesUseCase(userRepo, roleRepo);
    await expect(uc.execute({ targetUserId: 'user-1', actorUserId: 'u2', actorRoles: ['WORKER'] })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('404 khi target không tồn tại', async () => {
    const userRepo = { findById: jest.fn(async () => null) } as unknown as never;
    const roleRepo = { findActiveRolesByUserId: jest.fn(async () => []) } as unknown as never;
    const uc = new GetUserRolesUseCase(userRepo, roleRepo);
    await expect(uc.execute({ targetUserId: 'missing', actorUserId: 'admin-1', actorRoles: ['ADMIN'] })).rejects.toThrow(
      NotFoundException,
    );
  });
});
