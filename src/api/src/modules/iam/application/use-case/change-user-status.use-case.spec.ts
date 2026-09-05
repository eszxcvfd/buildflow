import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { ChangeUserStatusUseCase } from './change-user-status.use-case';
import { UserEntity } from '../../domain/entity/user.entity';
import { UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { AuditPort } from '../port/audit.port';
import { TransactionPort } from '../port/transaction.port';

function makeUser(status: 'ACTIVE' | 'LOCKED' | 'INACTIVE' = 'ACTIVE'): UserEntity {
  return new UserEntity({
    id: 'user-1',
    email: 'a@b.com',
    passwordHash: 'h',
    fullName: 'A',
    status,
    failedLoginCount: status === 'LOCKED' ? 5 : 0,
    lockedUntil: null,
    lastLoginAt: null,
    userType: 'STAFF',
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  } as ReturnType<UserEntity['getProps']>);
}

describe('ChangeUserStatusUseCase IAM-SRS-004 audit + transitions', () => {
  function build(stored: UserEntity | null = makeUser('ACTIVE')) {
    let s = stored ? makeUser(stored.status as 'ACTIVE' | 'LOCKED' | 'INACTIVE') : null;
    // keep original status for rollback assertion
    if (stored) {
      // clone fresh to avoid sharing reference with s after mutation
      s = new UserEntity({
        id: stored.id,
        email: stored.email,
        passwordHash: stored.getProps().passwordHash,
        fullName: stored.getProps().fullName,
        status: stored.status as 'ACTIVE' | 'LOCKED' | 'INACTIVE',
        failedLoginCount: stored.getProps().failedLoginCount,
        lockedUntil: stored.getProps().lockedUntil,
        lastLoginAt: stored.getProps().lastLoginAt,
        userType: stored.getProps().userType as 'STAFF',
        contractorId: stored.getProps().contractorId,
        createdAt: stored.getProps().createdAt,
        updatedAt: stored.getProps().updatedAt,
      } as ReturnType<UserEntity['getProps']>);
    }
    let db = s;
    const repo = {
      findById: jest.fn(async (id: string) => {
        if (db && db.id === id) return db;
        return null;
      }),
      save: jest.fn(async (u: UserEntity) => { db = u; }),
      saveWithClient: jest.fn(async (_c: PoolClient, u: UserEntity) => { db = u; }),
      findByEmail: jest.fn(async () => null),
      findByEmployeeCode: jest.fn(async () => null),
    } as unknown as jest.Mocked<UserRepositoryPort>;
    const audit = { log: jest.fn(async () => {}), logWithClient: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    const tx: jest.Mocked<TransactionPort> = {
      withTransaction: jest.fn(async (fn: (c: PoolClient) => Promise<unknown>) => {
        const snapshot = db ? new UserEntity({
          id: db.id,
          email: db.email,
          passwordHash: db.getProps().passwordHash,
          fullName: db.getProps().fullName,
          status: db.status as 'ACTIVE' | 'LOCKED' | 'INACTIVE',
          failedLoginCount: db.getProps().failedLoginCount,
          lockedUntil: db.getProps().lockedUntil,
          lastLoginAt: db.getProps().lastLoginAt,
          userType: db.getProps().userType as 'STAFF',
          contractorId: db.getProps().contractorId,
          createdAt: db.getProps().createdAt,
          updatedAt: db.getProps().updatedAt,
        } as ReturnType<UserEntity['getProps']>) : null;
        try {
          const res = await fn({} as PoolClient);
          return res;
        } catch (e) {
          db = snapshot;
          throw e;
        }
      }),
    } as unknown as jest.Mocked<TransactionPort>;
    const uc = new ChangeUserStatusUseCase(repo, audit, tx);
    return { uc, repo, audit, tx, getStored: () => db! };
  }

  it('404 khi không tìm thấy', async () => {
    const { uc } = build(null);
    await expect(uc.execute({ targetUserId: 'missing', status: 'LOCKED', actorUserId: 'admin-1' })).rejects.toThrow(NotFoundException);
  });

  it('ACTIVE -> LOCKED success and audit IAM_USER_LOCKED', async () => {
    const { uc, audit, getStored, tx } = build(makeUser('ACTIVE'));
    const { entity } = await uc.execute({ targetUserId: 'user-1', status: 'LOCKED', actorUserId: 'admin-1', ipAddress: '1.1.1.1', userAgent: 'jest' });
    expect(entity.status).toBe('LOCKED');
    expect(getStored().status).toBe('LOCKED');
    expect(tx.withTransaction).toHaveBeenCalled();
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'IAM_USER_LOCKED', result: 'SUCCESS', actorUserId: 'admin-1' }));
  });

  it('LOCKED -> ACTIVE success and audit IAM_USER_UNLOCKED clears lock', async () => {
    const { uc, audit } = build(makeUser('LOCKED'));
    const { entity } = await uc.execute({ targetUserId: 'user-1', status: 'ACTIVE', actorUserId: 'admin-1' });
    expect(entity.status).toBe('ACTIVE');
    expect(entity.lockedUntil).toBeNull();
    expect(entity.failedLoginCount).toBe(0);
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'IAM_USER_UNLOCKED' }));
  });

  it('ACTIVE -> INACTIVE audit IAM_USER_DEACTIVATED', async () => {
    const { uc, audit } = build(makeUser('ACTIVE'));
    await uc.execute({ targetUserId: 'user-1', status: 'INACTIVE', actorUserId: 'admin-1' });
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'IAM_USER_DEACTIVATED' }));
  });

  it('INACTIVE -> ACTIVE audit IAM_USER_REACTIVATED', async () => {
    const { uc, audit } = build(makeUser('INACTIVE'));
    await uc.execute({ targetUserId: 'user-1', status: 'ACTIVE', actorUserId: 'admin-1' });
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'IAM_USER_REACTIVATED' }));
  });

  it('cùng trạng thái ném BadRequest', async () => {
    const { uc } = build(makeUser('ACTIVE'));
    await expect(uc.execute({ targetUserId: 'user-1', status: 'ACTIVE', actorUserId: 'admin-1' })).rejects.toThrow(BadRequestException);
  });

  it('audit failure must fail mutation (InternalServerError) per AC', async () => {
    const { uc, audit } = build(makeUser('ACTIVE'));
    (audit.logWithClient as jest.Mock) = jest.fn(async () => { throw new Error('audit down'); });
    await expect(uc.execute({ targetUserId: 'user-1', status: 'LOCKED', actorUserId: 'admin-1' })).rejects.toThrow(InternalServerErrorException);
    const { uc: uc2, audit: audit2 } = build(makeUser('ACTIVE'));
    (audit2.logWithClient as jest.Mock) = jest.fn(async () => { throw new Error('audit down'); });
    await expect(uc2.execute({ targetUserId: 'user-1', status: 'LOCKED', actorUserId: 'admin-1' })).rejects.toThrow('Không thể ghi nhật ký kiểm toán');
  });

  it('audit failure rolls back repository state — atomically unchanged', async () => {
    const { uc, audit, getStored } = build(makeUser('ACTIVE'));
    (audit.logWithClient as jest.Mock) = jest.fn(async () => { throw new Error('audit down'); });
    await expect(uc.execute({ targetUserId: 'user-1', status: 'LOCKED', actorUserId: 'admin-1' })).rejects.toThrow(InternalServerErrorException);
    // DB state must still be ACTIVE (rollback), not LOCKED
    expect(getStored().status).toBe('ACTIVE');
    expect(audit.logWithClient).toHaveBeenCalled();
    // retry succeeds after transient failure
    const { uc: uc2, audit: audit2, getStored: getStored2 } = build(makeUser('ACTIVE'));
    // use same audit mock that now succeeds? Create new that succeeds
    (audit2.logWithClient as jest.Mock) = jest.fn(async () => {});
    const { entity } = await uc2.execute({ targetUserId: 'user-1', status: 'LOCKED', actorUserId: 'admin-1' });
    expect(entity.status).toBe('LOCKED');
    expect(getStored2().status).toBe('LOCKED');
  });

  it('IAM-SRS-008: dedup (ON CONFLICT DO NOTHING) không phải lỗi — business write vẫn commit', async () => {
    const { uc, audit, getStored } = build(makeUser('ACTIVE'));
    // PgAuditRepository với dedup resolve bình thường (rowCount 0, không throw):
    // retry/duplicate event không được abort mutation bắt buộc.
    (audit.logWithClient as jest.Mock) = jest.fn(async () => { /* dedup no-op */ });
    const { entity } = await uc.execute({ targetUserId: 'user-1', status: 'LOCKED', actorUserId: 'admin-1' });
    expect(entity.status).toBe('LOCKED');
    expect(getStored().status).toBe('LOCKED');
    expect(audit.logWithClient).toHaveBeenCalled();
  });

  it('IAM-SRS-008: correlationId đi vào audit payload trong tx (dedup theo (correlationId, action))', async () => {
    const corr = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';
    const { uc, audit } = build(makeUser('ACTIVE'));
    await uc.execute({ targetUserId: 'user-1', status: 'LOCKED', actorUserId: 'admin-1', correlationId: corr });
    expect(audit.logWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'IAM_USER_LOCKED', correlationId: corr }),
    );
  });

  it('IAM-SRS-008: dedup no-op khi có correlationId (retry cùng header) không abort business write', async () => {
    const corr = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';
    const { uc, audit, getStored } = build(makeUser('ACTIVE'));
    // Dedup insert (retry cùng (correlationId, action)): rowCount 0, không throw —
    // giống assign-roles, mutation vẫn commit dù audit record không được ghi mới.
    (audit.logWithClient as jest.Mock) = jest.fn(async () => { /* dedup no-op */ });
    const { entity } = await uc.execute({
      targetUserId: 'user-1', status: 'LOCKED', actorUserId: 'admin-1', correlationId: corr,
    });
    expect(entity.status).toBe('LOCKED');
    expect(getStored().status).toBe('LOCKED');
    expect(audit.logWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ correlationId: corr, action: 'IAM_USER_LOCKED' }),
    );
  });

  it('correlationId absent → audit payload correlationId null', async () => {
    const { uc, audit } = build(makeUser('ACTIVE'));
    await uc.execute({ targetUserId: 'user-1', status: 'LOCKED', actorUserId: 'admin-1' });
    expect(audit.logWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ correlationId: null }),
    );
  });

  it('audit payload contains actor + before/after and no passwordHash', async () => {
    const { uc, audit } = build(makeUser('ACTIVE'));
    await uc.execute({ targetUserId: 'user-1', status: 'LOCKED', actorUserId: 'admin-99' });
    const call = (audit.logWithClient as jest.Mock).mock.calls[0][1] as { actorUserId: string; beforeData: { passwordHash?: string }; afterData: { passwordHash?: string } };
    expect(call.actorUserId).toBe('admin-99');
    expect(call.beforeData.passwordHash).toBeUndefined();
    expect(call.afterData.passwordHash).toBeUndefined();
  });

  it('response never exposes passwordHash', async () => {
    const { uc } = build(makeUser('ACTIVE'));
    const { entity } = await uc.execute({ targetUserId: 'user-1', status: 'LOCKED', actorUserId: 'admin-1' });
    expect((entity.toPublicProfile() as unknown as { passwordHash?: string }).passwordHash).toBeUndefined();
  });
});
