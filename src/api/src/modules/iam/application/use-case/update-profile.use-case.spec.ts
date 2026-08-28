import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpdateProfileUseCase } from './update-profile.use-case';
import { UserEntity } from '../../domain/entity/user.entity';

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

describe('UpdateProfileUseCase IAM-SRS-003', () => {
  function build(repoUser: UserEntity | null = makeUser()) {
    let stored: UserEntity | null = repoUser;
    const repo = {
      findById: jest.fn(async () => stored),
      save: jest.fn(async (u: UserEntity) => { stored = u; }),
    } as unknown as { findById: jest.Mock; save: jest.Mock };

    const audit = { log: jest.fn(async () => {}) } as unknown as { log: jest.Mock };

    const uc = new UpdateProfileUseCase(repo as never, audit as never);
    return { uc, repo, audit, getStored: () => stored! };
  }

  it('updates whitelist fields and persists', async () => {
    const { uc, repo, audit, getStored } = build();
    const { entity } = await uc.execute({
      userId: 'user-1',
      fullName: 'Bob Tran',
      phone: '+84901234567',
      avatarUrl: 'https://cdn.example.com/b.png',
    });
    expect(entity.fullName).toBe('Bob Tran');
    expect(entity.phone).toBe('+84901234567');
    expect(entity.avatarUrl).toBe('https://cdn.example.com/b.png');
    expect(repo.save).toHaveBeenCalled();
    expect(getStored().fullName).toBe('Bob Tran');
    // audit IAM-SRS-008: must log PII change without passwordHash
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'IAM_PROFILE_UPDATED',
      result: 'SUCCESS',
      actorUserId: 'user-1',
    }));
    const after = (audit.log.mock.calls[0][0] as { afterData: { passwordHash?: string }}).afterData;
    expect(after.passwordHash).toBeUndefined();
  });

  it('rejects empty fullName', async () => {
    const { uc } = build();
    await expect(uc.execute({ userId: 'user-1', fullName: '   ' })).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid phone', async () => {
    const { uc } = build();
    await expect(uc.execute({ userId: 'user-1', phone: 'abc' })).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid avatarUrl', async () => {
    const { uc } = build();
    await expect(uc.execute({ userId: 'user-1', avatarUrl: 'not-a-url' })).rejects.toThrow(BadRequestException);
  });

  it('allows clearing phone/avatar with null', async () => {
    const { uc, getStored } = build(makeUser({ phone: '0123', avatarUrl: 'https://cdn.example.com/a.png' }));
    await uc.execute({ userId: 'user-1', phone: null, avatarUrl: null });
    expect(getStored().phone).toBeNull();
    expect(getStored().avatarUrl).toBeNull();
  });

  it('throws 404 when user not found', async () => {
    const repo = { findById: jest.fn(async () => null), save: jest.fn() } as never;
    const audit = { log: jest.fn() } as never;
    const uc = new UpdateProfileUseCase(repo, audit);
    await expect(uc.execute({ userId: 'missing', fullName: 'X' })).rejects.toThrow(NotFoundException);
  });

  it('response never exposes passwordHash via public profile', async () => {
    const { uc } = build();
    const { entity } = await uc.execute({ userId: 'user-1', fullName: 'OK Name' });
    // internal passwordHash exists for domain but public mapper must not expose it
    const pub = entity.toPublicProfile() as Record<string, unknown>;
    expect(pub.passwordHash).toBeUndefined();
    expect(pub.fullName).toBe('OK Name');
  });
});
