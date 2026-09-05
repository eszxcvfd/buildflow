import { BadRequestException, ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { UpdateUserUseCase } from './update-user.use-case';
import { UserEntity } from '../../domain/entity/user.entity';
import { UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { AuditPort } from '../port/audit.port';
import { TransactionPort } from '../port/transaction.port';

function makeUser(overrides: Partial<ReturnType<UserEntity['getProps']>> = {}): UserEntity {
  return new UserEntity({
    id: 'user-1',
    email: 'alice@example.com',
    passwordHash: '$2b$10$hash',
    fullName: 'Alice Nguyen',
    phone: null,
    avatarUrl: null,
    status: 'ACTIVE',
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    userType: 'STAFF',
    contractorId: null,
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
    ...overrides,
  } as ReturnType<UserEntity['getProps']>);
}

describe('UpdateUserUseCase IAM-SRS-004', () => {
  function build(storedUser: UserEntity | null = makeUser(), otherUsers: UserEntity[] = []) {
    let stored = storedUser;
    // keep pristine snapshot for rollback verification
    const pristine = stored ? makeUser(stored.getProps() as unknown as Partial<ReturnType<UserEntity['getProps']>>) : null;
    const repo = {
      findById: jest.fn(async (id: string) => {
        // simulate DB read — return a fresh clone so mutation outside tx doesn't leak if rolled back?
        // For simplicity, return stored directly (will be reverted via tx snapshot)
        if (stored && stored.id === id) return stored;
        return null;
      }),
      findByEmail: jest.fn(async (email: string) => otherUsers.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null),
      findByEmployeeCode: jest.fn(async (code: string) => otherUsers.find((u) => u.employeeCode === code) ?? null),
      save: jest.fn(async (u: UserEntity) => { stored = u; }),
      saveWithClient: jest.fn(async (_c: PoolClient, u: UserEntity) => { stored = u; }),
      create: jest.fn(async (u: UserEntity) => { stored = u; }),
      createWithClient: jest.fn(async (_c: PoolClient, u: UserEntity) => { stored = u; }),
    } as unknown as jest.Mocked<UserRepositoryPort>;
    const audit = { log: jest.fn(async () => {}), logWithClient: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    const tx: jest.Mocked<TransactionPort> = {
      withTransaction: jest.fn(async (fn: (c: PoolClient) => Promise<unknown>) => {
        // snapshot DB state before transaction
        const snapshot = stored ? makeUser(stored.getProps() as unknown as Partial<ReturnType<UserEntity['getProps']>>) : null;
        const snapshotFullName = stored?.fullName ?? null;
        try {
          const res = await fn({} as PoolClient);
          return res;
        } catch (e) {
          // rollback DB state
          if (snapshot) {
            // restore stored to snapshot (also revert in-memory mutation on the entity if it was the same object)
            // If stored was mutated to new fullName, revert it
            stored = snapshot;
            // Also revert the original object if it's still referenced externally? For test, we replace stored entirely.
          } else {
            stored = snapshot;
          }
          // For cases where the entity object itself was mutated before save (updateAdmin), the stored snapshot is a clone, so mutation is undone in DB view.
          // Note: the original user object passed to save is mutated, but DB view is snapshot.
          void snapshotFullName;
          throw e;
        }
      }),
    } as unknown as jest.Mocked<TransactionPort>;
    const uc = new UpdateUserUseCase(repo, audit, tx);
    return { uc, repo, audit, tx, getStored: () => stored!, setStored: (v: UserEntity | null) => { stored = v; }, getPristine: () => pristine };
  }

  it('cập nhật thành công và audit IAM_USER_UPDATED với before/after', async () => {
    const { uc, audit, getStored, tx } = build();
    const { entity } = await uc.execute({ targetUserId: 'user-1', fullName: 'Bob Tran', actorUserId: 'admin-1' });
    expect(entity.fullName).toBe('Bob Tran');
    expect(getStored().fullName).toBe('Bob Tran');
    expect(tx.withTransaction).toHaveBeenCalled();
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'IAM_USER_UPDATED', result: 'SUCCESS', actorUserId: 'admin-1' }));
    const call = (audit.logWithClient as jest.Mock).mock.calls[0][1] as { beforeData: { fullName: string }; afterData: { fullName: string } };
    expect(call.beforeData.fullName).toBe('Alice Nguyen');
    expect(call.afterData.fullName).toBe('Bob Tran');
    expect((call.afterData as unknown as { passwordHash?: string }).passwordHash).toBeUndefined();
  });

  it('404 khi không tìm thấy tài khoản', async () => {
    const { uc } = build(null);
    await expect(uc.execute({ targetUserId: 'missing', fullName: 'X', actorUserId: 'admin-1' })).rejects.toThrow(NotFoundException);
  });

  it('email trùng pre-check trả 409', async () => {
    const other = makeUser({ id: 'other', email: 'dup@example.com' });
    const { uc } = build(makeUser(), [other]);
    await expect(uc.execute({ targetUserId: 'user-1', email: 'dup@example.com', actorUserId: 'admin-1' })).rejects.toThrow(ConflictException);
  });

  it('email trùng chính mình cho phép (idempotent)', async () => {
    // same email as self, findByEmail returns self but id matches => no conflict
    const self = makeUser();
    let stored = self;
    const repo = {
      findById: jest.fn(async () => stored),
      findByEmail: jest.fn(async () => self),
      findByEmployeeCode: jest.fn(async () => null),
      save: jest.fn(async (_u: UserEntity) => { stored = _u; }),
      saveWithClient: jest.fn(async (_c: PoolClient, u: UserEntity) => { stored = u; }),
    } as unknown as jest.Mocked<UserRepositoryPort>;
    const audit = { log: jest.fn(async () => {}), logWithClient: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    const tx: jest.Mocked<TransactionPort> = { withTransaction: jest.fn(async (fn: (c: PoolClient) => Promise<unknown>) => fn({} as PoolClient)) } as unknown as jest.Mocked<TransactionPort>;
    const useCase = new UpdateUserUseCase(repo, audit, tx);
    const { entity } = await useCase.execute({ targetUserId: 'user-1', email: 'alice@example.com', actorUserId: 'admin-1' });
    expect(entity.email).toBe('alice@example.com');
  });

  it('employeeCode trùng trả 409', async () => {
    const other = makeUser({ id: 'other', employeeCode: 'EMP001', email: 'other@example.com' });
    const { uc } = build(makeUser(), [other]);
    await expect(uc.execute({ targetUserId: 'user-1', employeeCode: 'EMP001', actorUserId: 'admin-1' })).rejects.toThrow(ConflictException);
  });

  it('DB unique violation race (23505) maps to 409', async () => {
    const { uc, repo } = build();
    (repo.saveWithClient as jest.Mock) = jest.fn(async () => {
      const err = Object.assign(new Error('duplicate key value violates unique constraint "ux_users_email_lower"'), {
        code: '23505', constraint: 'ux_users_email_lower', detail: 'Key (lower(email))=(dup2@example.com) already exists.',
      });
      throw err;
    });
    await expect(uc.execute({ targetUserId: 'user-1', email: 'dup2@example.com', actorUserId: 'admin-1' })).rejects.toThrow(ConflictException);
  });

  it('phone DB violation maps to 409', async () => {
    const { uc, repo } = build();
    (repo.saveWithClient as jest.Mock) = jest.fn(async () => {
      const err = Object.assign(new Error('duplicate key value violates unique constraint "ux_users_phone"'), {
        code: '23505', constraint: 'ux_users_phone', detail: 'Key (phone)=(0123456789) already exists.',
      });
      throw err;
    });
    await expect(uc.execute({ targetUserId: 'user-1', phone: '0123456789', actorUserId: 'admin-1' })).rejects.toThrow('Số điện thoại đã tồn tại');
  });

  it('audit failure fails mutation with 500', async () => {
    const { uc, audit } = build();
    (audit.logWithClient as jest.Mock) = jest.fn(async () => { throw new Error('audit down'); });
    await expect(uc.execute({ targetUserId: 'user-1', fullName: 'Fail', actorUserId: 'admin-1' })).rejects.toThrow(InternalServerErrorException);
  });

  it('IAM-SRS-008: correlationId hợp lệ đi vào audit payload IAM_USER_UPDATED', async () => {
    const corr = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';
    const { uc, audit } = build();
    await uc.execute({ targetUserId: 'user-1', fullName: 'Bob Tran', actorUserId: 'admin-1', correlationId: corr });
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'IAM_USER_UPDATED', correlationId: corr }));
  });

  it('IAM-SRS-008: correlationId absent (controller strict cho phép null) → audit payload correlationId null', async () => {
    const { uc, audit } = build();
    await uc.execute({ targetUserId: 'user-1', fullName: 'Bob Tran', actorUserId: 'admin-1' });
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'IAM_USER_UPDATED', correlationId: null }));
  });

  it('audit failure rolls back repository state — atomically unchanged', async () => {
    const { uc, audit, getStored } = build();
    const beforeFullName = getStored().fullName;
    (audit.logWithClient as jest.Mock) = jest.fn(async () => { throw new Error('audit down'); });
    await expect(uc.execute({ targetUserId: 'user-1', fullName: 'ShouldRollback', actorUserId: 'admin-1' })).rejects.toThrow(InternalServerErrorException);
    // DB state must be unchanged (rollback) — fullName stays as before
    expect(getStored().fullName).toBe(beforeFullName);
    expect(audit.logWithClient).toHaveBeenCalled();
  });

  it('response never exposes passwordHash', async () => {
    const { uc } = build();
    const { entity } = await uc.execute({ targetUserId: 'user-1', fullName: 'New', actorUserId: 'admin-1' });
    expect((entity.toPublicProfile() as unknown as { passwordHash?: string }).passwordHash).toBeUndefined();
  });

  it('invalid domain data throws BadRequest', async () => {
    const { uc } = build();
    await expect(uc.execute({ targetUserId: 'user-1', email: 'not-an-email', actorUserId: 'admin-1' })).rejects.toThrow(BadRequestException);
  });
});
