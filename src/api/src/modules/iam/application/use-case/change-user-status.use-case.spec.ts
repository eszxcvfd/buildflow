import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ChangeUserStatusUseCase } from './change-user-status.use-case';
import { UserEntity } from '../../domain/entity/user.entity';
import { UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { AuditPort } from '../port/audit.port';

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
    let s = stored;
    const repo = {
      findById: jest.fn(async (id: string) => (s && s.id === id ? s : null)),
      save: jest.fn(async (u: UserEntity) => { s = u; }),
    } as unknown as jest.Mocked<UserRepositoryPort>;
    const audit = { log: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    const uc = new ChangeUserStatusUseCase(repo, audit);
    return { uc, repo, audit, getStored: () => s! };
  }

  it('404 khi không tìm thấy', async () => {
    const { uc } = build(null);
    await expect(uc.execute({ targetUserId: 'missing', status: 'LOCKED', actorUserId: 'admin-1' })).rejects.toThrow(NotFoundException);
  });

  it('ACTIVE -> LOCKED success and audit IAM_USER_LOCKED', async () => {
    const { uc, audit, getStored } = build(makeUser('ACTIVE'));
    const { entity } = await uc.execute({ targetUserId: 'user-1', status: 'LOCKED', actorUserId: 'admin-1', ipAddress: '1.1.1.1', userAgent: 'jest' });
    expect(entity.status).toBe('LOCKED');
    expect(getStored().status).toBe('LOCKED');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'IAM_USER_LOCKED', result: 'SUCCESS', actorUserId: 'admin-1' }));
  });

  it('LOCKED -> ACTIVE success and audit IAM_USER_UNLOCKED clears lock', async () => {
    const { uc, audit } = build(makeUser('LOCKED'));
    const { entity } = await uc.execute({ targetUserId: 'user-1', status: 'ACTIVE', actorUserId: 'admin-1' });
    expect(entity.status).toBe('ACTIVE');
    expect(entity.lockedUntil).toBeNull();
    expect(entity.failedLoginCount).toBe(0);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'IAM_USER_UNLOCKED' }));
  });

  it('ACTIVE -> INACTIVE audit IAM_USER_DEACTIVATED', async () => {
    const { uc, audit } = build(makeUser('ACTIVE'));
    await uc.execute({ targetUserId: 'user-1', status: 'INACTIVE', actorUserId: 'admin-1' });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'IAM_USER_DEACTIVATED' }));
  });

  it('INACTIVE -> ACTIVE audit IAM_USER_REACTIVATED', async () => {
    const { uc, audit } = build(makeUser('INACTIVE'));
    await uc.execute({ targetUserId: 'user-1', status: 'ACTIVE', actorUserId: 'admin-1' });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'IAM_USER_REACTIVATED' }));
  });

  it('cùng trạng thái ném BadRequest', async () => {
    const { uc } = build(makeUser('ACTIVE'));
    await expect(uc.execute({ targetUserId: 'user-1', status: 'ACTIVE', actorUserId: 'admin-1' })).rejects.toThrow(BadRequestException);
  });

  it('audit failure must fail mutation (InternalServerError) per AC', async () => {
    const { uc, audit } = build(makeUser('ACTIVE'));
    (audit.log as jest.Mock) = jest.fn(async () => { throw new Error('audit down'); });
    await expect(uc.execute({ targetUserId: 'user-1', status: 'LOCKED', actorUserId: 'admin-1' })).rejects.toThrow(InternalServerErrorException);
    // second fresh instance to check message
    const { uc: uc2, audit: audit2 } = build(makeUser('ACTIVE'));
    (audit2.log as jest.Mock) = jest.fn(async () => { throw new Error('audit down'); });
    await expect(uc2.execute({ targetUserId: 'user-1', status: 'LOCKED', actorUserId: 'admin-1' })).rejects.toThrow('Không thể ghi nhật ký kiểm toán');
    // Ensure save was already called but client gets error — in transaction this would rollback; here error is propagated
  });

  it('audit payload contains actor + before/after and no passwordHash', async () => {
    const { uc, audit } = build(makeUser('ACTIVE'));
    await uc.execute({ targetUserId: 'user-1', status: 'LOCKED', actorUserId: 'admin-99' });
    const call = (audit.log as jest.Mock).mock.calls[0][0] as { actorUserId: string; beforeData: { passwordHash?: string }; afterData: { passwordHash?: string } };
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
