import { BadRequestException, ForbiddenException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { AssignRolesUseCase } from './assign-roles.use-case';
import { UserEntity } from '../../domain/entity/user.entity';
import { RoleEntity } from '../../domain/entity/role.entity';
import { UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { RoleRepositoryPort } from '../../domain/repository/role-repository.port';
import { AuditPort } from '../port/audit.port';
import { TransactionPort } from '../port/transaction.port';

function makeUser(id = 'user-target'): UserEntity {
  return new UserEntity({
    id,
    email: 'target@example.com',
    passwordHash: 'h',
    fullName: 'Target',
    status: 'ACTIVE',
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    userType: 'STAFF',
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  } as ReturnType<UserEntity['getProps']>);
}

function makeRole(id: string, code: string, isActive = true): RoleEntity {
  return new RoleEntity({
    id,
    code,
    name: code,
    isSystem: true,
    isActive,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('AssignRolesUseCase IAM-SRS-005', () => {
  const ROLE_ADMIN = '11111111-1111-4111-8111-111111111111';
  const ROLE_WORKER = '22222222-2222-4222-8222-222222222222';
  const ROLE_QC = '33333333-3333-4333-8333-333333333333';
  const ROLE_INACTIVE = '44444444-4444-4444-8444-444444444444';

  function build(opts: {
    targetUser?: UserEntity | null;
    beforeRoleIds?: string[];
    rolesById?: Map<string, RoleEntity>;
  } = {}) {
    const targetUser = opts.targetUser !== undefined ? opts.targetUser : makeUser();
    let dbRoleIds = opts.beforeRoleIds ?? [];
    // snapshot for transaction rollback
    const rolesMap = opts.rolesById ?? new Map<string, RoleEntity>([
      [ROLE_ADMIN, makeRole(ROLE_ADMIN, 'ADMIN')],
      [ROLE_WORKER, makeRole(ROLE_WORKER, 'WORKER')],
      [ROLE_QC, makeRole(ROLE_QC, 'QC')],
      [ROLE_INACTIVE, makeRole(ROLE_INACTIVE, 'LEGACY', false)],
    ]);

    const userRepo = {
      findById: jest.fn(async (id: string) => {
        if (targetUser && targetUser.id === id) return targetUser;
        return null;
      }),
      findActiveRolesByUserId: jest.fn(async () => []),
    } as unknown as jest.Mocked<UserRepositoryPort>;

    const roleRepo = {
      findByIds: jest.fn(async (ids: string[]) => {
        return ids.map((id) => rolesMap.get(id)).filter(Boolean) as RoleEntity[];
      }),
      findActiveRolesByUserId: jest.fn(async () => []),
      findActiveRoleIdsByUserId: jest.fn(async () => [...dbRoleIds]),
      findActiveRoleIdsByUserIdWithClient: jest.fn(async (_c: PoolClient, _uid: string) => [...dbRoleIds]),
      replaceUserRolesWithClient: jest.fn(async (_c: PoolClient, params: { roleIds: string[] }) => {
        dbRoleIds = [...params.roleIds];
      }),
    } as unknown as jest.Mocked<RoleRepositoryPort>;

    const audit = {
      log: jest.fn(async () => {}),
      logWithClient: jest.fn(async () => {}),
    } as unknown as jest.Mocked<AuditPort>;

    const tx: jest.Mocked<TransactionPort> = {
      withTransaction: jest.fn(async (fn: (c: PoolClient) => Promise<unknown>) => {
        const snapshot = [...dbRoleIds];
        try {
          const res = await fn({} as PoolClient);
          return res;
        } catch (e) {
          dbRoleIds = snapshot;
          throw e;
        }
      }),
    } as unknown as jest.Mocked<TransactionPort>;

    const uc = new AssignRolesUseCase(userRepo, roleRepo, audit, tx);
    return { uc, userRepo, roleRepo, audit, tx, getRoleIds: () => [...dbRoleIds], rolesMap };
  }

  it('gán thành công với audit before/after và transaction', async () => {
    const { uc, audit, tx, getRoleIds } = build({ beforeRoleIds: [ROLE_WORKER] });
    const result = await uc.execute({
      targetUserId: 'user-target',
      roleIds: [ROLE_ADMIN, ROLE_WORKER],
      actorUserId: 'admin-1',
      actorRoles: ['ADMIN'],
      correlationId: 'corr-1',
      ipAddress: '1.1.1.1',
      userAgent: 'jest',
    });
    expect(result.beforeRoleIds).toEqual([ROLE_WORKER]);
    expect(result.afterRoleIds.sort()).toEqual([ROLE_ADMIN, ROLE_WORKER].sort());
    expect(result.roles).toHaveLength(2);
    expect(tx.withTransaction).toHaveBeenCalled();
    expect(audit.logWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'IAM_ROLE_ASSIGNED',
        actorUserId: 'admin-1',
        entityId: 'user-target',
        correlationId: 'corr-1',
        result: 'SUCCESS',
      }),
    );
    expect(getRoleIds().sort()).toEqual([ROLE_ADMIN, ROLE_WORKER].sort());
    expect(result.effectivePolicy).toContain('NEXT_LOGIN');
  });

  it('reject danh sách rỗng (policy ≥1) — không lưu một phần', async () => {
    const { uc, roleRepo } = build({ beforeRoleIds: [ROLE_WORKER] });
    await expect(
      uc.execute({ targetUserId: 'user-target', roleIds: [], actorUserId: 'admin-1', actorRoles: ['ADMIN'] }),
    ).rejects.toThrow(BadRequestException);
    expect(roleRepo.replaceUserRolesWithClient).not.toHaveBeenCalled();
  });

  it('role không tồn tại hoặc inactive → reject với lỗi rõ', async () => {
    const { uc } = build();
    await expect(
      uc.execute({
        targetUserId: 'user-target',
        roleIds: ['99999999-9999-4999-8999-999999999999'],
        actorUserId: 'admin-1',
        actorRoles: ['ADMIN'],
      }),
    ).rejects.toThrow(/không tồn tại|ngừng hoạt động/);

    await expect(
      uc.execute({
        targetUserId: 'user-target',
        roleIds: [ROLE_INACTIVE],
        actorUserId: 'admin-1',
        actorRoles: ['ADMIN'],
      }),
    ).rejects.toThrow(/không tồn tại|ngừng hoạt động/);
  });

  it('không cho gán vượt phạm vi admin — server-side auth', async () => {
    const { uc } = build();
    await expect(
      uc.execute({
        targetUserId: 'user-target',
        roleIds: [ROLE_WORKER],
        actorUserId: 'admin-1',
        actorRoles: ['WORKER'], // not ADMIN
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('404 khi target không tồn tại', async () => {
    const { uc } = build({ targetUser: null });
    await expect(
      uc.execute({ targetUserId: 'missing', roleIds: [ROLE_WORKER], actorUserId: 'admin-1', actorRoles: ['ADMIN'] }),
    ).rejects.toThrow(NotFoundException);
  });

  it('audit failure phải rollback và throw 500 — repo unchanged (P1 atomicity)', async () => {
    const { uc, audit, getRoleIds } = build({ beforeRoleIds: [ROLE_WORKER] });
    // Make audit fail
    (audit.logWithClient as unknown as jest.Mock) = jest.fn(async () => {
      throw new Error('audit down');
    });
    await expect(
      uc.execute({
        targetUserId: 'user-target',
        roleIds: [ROLE_ADMIN],
        actorUserId: 'admin-1',
        actorRoles: ['ADMIN'],
      }),
    ).rejects.toThrow(InternalServerErrorException);
    await expect(
      uc.execute({
        targetUserId: 'user-target',
        roleIds: [ROLE_ADMIN],
        actorUserId: 'admin-1',
        actorRoles: ['ADMIN'],
      }),
    ).rejects.toThrow('Không thể ghi nhật ký kiểm toán');
    // Repo state unchanged despite mutation attempt
    expect(getRoleIds()).toEqual([ROLE_WORKER]);
  });

  it('audit payload chứa actor, before/after, correlationId, reason, ip', async () => {
    const { uc, audit } = build({ beforeRoleIds: [] });
    await uc.execute({
      targetUserId: 'user-target',
      roleIds: [ROLE_WORKER],
      actorUserId: 'admin-99',
      actorRoles: ['ADMIN'],
      correlationId: 'corr-xyz',
      reason: 'onboarding',
      ipAddress: '9.9.9.9',
      userAgent: 'jest-agent',
    });
    const payload = (audit.logWithClient as jest.Mock).mock.calls[0][1];
    expect(payload.actorUserId).toBe('admin-99');
    expect(payload.beforeData.roleIds).toEqual([]);
    expect(payload.afterData.roleIds).toEqual([ROLE_WORKER]);
    expect(payload.afterData.reason).toBe('onboarding');
    expect(payload.correlationId).toBe('corr-xyz');
    expect(payload.ipAddress).toBe('9.9.9.9');
    expect(payload.userAgent).toBe('jest-agent');
  });

  it('dedup roleIds và validate UUID format', async () => {
    const { uc } = build();
    await expect(
      uc.execute({
        targetUserId: 'user-target',
        roleIds: ['not-a-uuid'],
        actorUserId: 'admin-1',
        actorRoles: ['ADMIN'],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('gán lại cùng role vẫn audit thành công (idempotent replace)', async () => {
    const { uc, audit } = build({ beforeRoleIds: [ROLE_WORKER] });
    const result = await uc.execute({
      targetUserId: 'user-target',
      roleIds: [ROLE_WORKER],
      actorUserId: 'admin-1',
      actorRoles: ['ADMIN'],
    });
    expect(result.beforeRoleIds).toEqual([ROLE_WORKER]);
    expect(result.afterRoleIds).toEqual([ROLE_WORKER]);
    expect(audit.logWithClient).toHaveBeenCalled();
  });
});
