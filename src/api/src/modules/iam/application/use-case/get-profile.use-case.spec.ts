import { NotFoundException } from '@nestjs/common';
import { GetProfileUseCase } from './get-profile.use-case';
import { UserEntity } from '../../domain/entity/user.entity';

function makeUser(overrides: Partial<ReturnType<UserEntity['getProps']>> = {}): UserEntity {
  return new UserEntity({
    id: 'user-1',
    email: 'alice@example.com',
    passwordHash: '$2b$10$hash',
    fullName: 'Alice Nguyen',
    phone: '0123456789',
    avatarUrl: 'https://cdn.example.com/a.png',
    status: 'ACTIVE',
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    userType: 'STAFF',
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
    ...overrides,
  } as ReturnType<UserEntity['getProps']>);
}

describe('GetProfileUseCase IAM-SRS-003', () => {
  it('returns profile without passwordHash', async () => {
    const user = makeUser();
    const repo = {
      findById: jest.fn(async () => user),
      findByEmail: jest.fn(),
      save: jest.fn(),
      findActiveRolesByUserId: jest.fn(),
      findActiveProjectIdsByUserId: jest.fn(),
    } as never;
    const uc = new GetProfileUseCase(repo);
    const { entity } = await uc.execute({ userId: 'user-1' });
    const pub = entity.toPublicProfile() as unknown as Record<string, unknown>;
    expect(pub.passwordHash).toBeUndefined();
    expect(entity.fullName).toBe('Alice Nguyen');
    expect(entity.phone).toBe('0123456789');
  });

  it('throws 404 when user not found', async () => {
    const repo = { findById: jest.fn(async () => null) } as never;
    const uc = new GetProfileUseCase(repo);
    await expect(uc.execute({ userId: 'missing' })).rejects.toThrow(NotFoundException);
  });
});
