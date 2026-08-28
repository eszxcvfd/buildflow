import { BadRequestException, ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { UpdateUserUseCase } from './update-user.use-case';
import { UserEntity } from '../../domain/entity/user.entity';
import { UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { AuditPort } from '../port/audit.port';

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
    const repo = {
      findById: jest.fn(async (id: string) => (stored && stored.id === id ? stored : null)),
      findByEmail: jest.fn(async (email: string) => otherUsers.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null),
      findByEmployeeCode: jest.fn(async (code: string) => otherUsers.find((u) => u.employeeCode === code) ?? null),
      save: jest.fn(async (u: UserEntity) => { stored = u; }),
    } as unknown as jest.Mocked<UserRepositoryPort>;
    const audit = { log: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    const uc = new UpdateUserUseCase(repo, audit);
    return { uc, repo, audit, getStored: () => stored! };
  }

  it('cập nhật thành công và audit IAM_USER_UPDATED với before/after', async () => {
    const { uc, audit, getStored } = build();
    const { entity } = await uc.execute({ targetUserId: 'user-1', fullName: 'Bob Tran', actorUserId: 'admin-1' });
    expect(entity.fullName).toBe('Bob Tran');
    expect(getStored().fullName).toBe('Bob Tran');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'IAM_USER_UPDATED', result: 'SUCCESS', actorUserId: 'admin-1' }));
    const call = (audit.log as jest.Mock).mock.calls[0][0] as { beforeData: { fullName: string }; afterData: { fullName: string } };
    expect(call.beforeData.fullName).toBe('Alice Nguyen');
    expect(call.afterData.fullName).toBe('Bob Tran');
    // passwordHash never in audit payload
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
    const { uc: _uc } = build(); void _uc;
    // same email as self, findByEmail returns self but id matches => no conflict
    const self = makeUser();
    const repo = {
      findById: jest.fn(async () => self),
      findByEmail: jest.fn(async () => self),
      findByEmployeeCode: jest.fn(async () => null),
      save: jest.fn(async (_u: UserEntity) => {}),
    } as unknown as jest.Mocked<UserRepositoryPort>;
    const audit = { log: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    const useCase = new UpdateUserUseCase(repo, audit);
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
    (repo.save as jest.Mock) = jest.fn(async () => {
      const err = Object.assign(new Error('duplicate key value violates unique constraint "ux_users_email_lower"'), {
        code: '23505', constraint: 'ux_users_email_lower', detail: 'Key (lower(email))=(dup2@example.com) already exists.',
      });
      throw err;
    });
    await expect(uc.execute({ targetUserId: 'user-1', email: 'dup2@example.com', actorUserId: 'admin-1' })).rejects.toThrow(ConflictException);
  });

  it('phone DB violation maps to 409', async () => {
    const { uc, repo } = build();
    (repo.save as jest.Mock) = jest.fn(async () => {
      const err = Object.assign(new Error('duplicate key value violates unique constraint "ux_users_phone"'), {
        code: '23505', constraint: 'ux_users_phone', detail: 'Key (phone)=(0123456789) already exists.',
      });
      throw err;
    });
    await expect(uc.execute({ targetUserId: 'user-1', phone: '0123456789', actorUserId: 'admin-1' })).rejects.toThrow('Số điện thoại đã tồn tại');
  });

  it('audit failure fails mutation with 500', async () => {
    const { uc, audit } = build();
    (audit.log as jest.Mock) = jest.fn(async () => { throw new Error('audit down'); });
    await expect(uc.execute({ targetUserId: 'user-1', fullName: 'Fail', actorUserId: 'admin-1' })).rejects.toThrow(InternalServerErrorException);
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
