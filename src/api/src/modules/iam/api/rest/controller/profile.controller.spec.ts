import { Test } from '@nestjs/testing';
import { ProfileController } from './profile.controller';
import { GetProfileUseCase } from '../../../application/use-case/get-profile.use-case';
import { UpdateProfileUseCase } from '../../../application/use-case/update-profile.use-case';
import { UserEntity } from '../../../domain/entity/user.entity';
import { USER_REPOSITORY } from '../../../domain/repository/user-repository.port';
import { AUDIT_PORT } from '../../../application/port/audit.port';
import { TOKEN_REVOCATION_PORT } from '../../../application/port/token-revocation.port';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { JwtTokenService } from '../../../infrastructure/security/jwt-token.service';
import { HASHER_PORT } from '../../../application/port/hasher.port';
import { TOKEN_PORT } from '../../../application/port/token.port';

function makeUser(): UserEntity {
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
    contractorId: null,
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  } as ReturnType<UserEntity['getProps']>);
}

const VALID_CORR = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';

/** Boot the module with a PATCH use case whose execute stays replaceable via the holder. */
async function bootModule(user: UserEntity, holder: { execute: jest.Mock }) {
  const module = await Test.createTestingModule({
    controllers: [ProfileController],
    providers: [
      { provide: GetProfileUseCase, useValue: { execute: jest.fn() } },
      { provide: UpdateProfileUseCase, useValue: holder },
      { provide: USER_REPOSITORY, useValue: {} },
      { provide: AUDIT_PORT, useValue: {} },
      { provide: HASHER_PORT, useValue: {} },
      { provide: TOKEN_PORT, useValue: {} },
      { provide: TOKEN_REVOCATION_PORT, useValue: { isRevoked: jest.fn(async () => false) } },
      { provide: JwtTokenService, useValue: { verify: jest.fn(async () => ({ sub: 'user-1', jti: 'jti1' })) } },
      { provide: JwtAuthGuard, useValue: { canActivate: jest.fn(async () => true) } },
    ],
  }).compile();
  return module.get(ProfileController);
}

describe('ProfileController GET+PATCH /api/v1/me/profile (IAM-SRS-003)', () => {
  it('GET returns public profile without passwordHash', async () => {
    const user = makeUser();
    const module = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        { provide: GetProfileUseCase, useValue: { execute: jest.fn(async () => ({ entity: user })) } },
        { provide: UpdateProfileUseCase, useValue: { execute: jest.fn() } },
        { provide: USER_REPOSITORY, useValue: {} },
        { provide: AUDIT_PORT, useValue: {} },
        { provide: HASHER_PORT, useValue: {} },
        { provide: TOKEN_PORT, useValue: {} },
        { provide: TOKEN_REVOCATION_PORT, useValue: { isRevoked: jest.fn(async () => false) } },
        { provide: JwtTokenService, useValue: { verify: jest.fn(async () => ({ sub: 'user-1', jti: 'jti1' })) } },
        { provide: JwtAuthGuard, useValue: { canActivate: jest.fn(async () => true) } },
      ],
    }).compile();

    const ctrl = module.get(ProfileController);
    const result = await ctrl.getProfileHandler({ headers: {}, user: { sub: 'user-1' } } as never);
    expect(result.email).toBe('alice@example.com');
    expect((result as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
    expect(result.fullName).toBe('Alice Nguyen');
  });

  it('PATCH whitelists only fullName/phone/avatarUrl', async () => {
    const user = makeUser();
    const updateMock = jest.fn(async () => ({ entity: new UserEntity({ ...user.getProps(), fullName: 'Bob Tran' } as ReturnType<UserEntity['getProps']>) }));
    const holder = { execute: updateMock };
    const ctrl = await bootModule(user, holder);
    const result = await ctrl.updateProfileHandler({ fullName: 'Bob Tran' } as never, { headers: {}, ip: '127.0.0.1', user: { sub: 'user-1' } } as never);
    expect(result.fullName).toBe('Bob Tran');
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ fullName: 'Bob Tran', userId: 'user-1' }));
    // ensure email/roles not in call
    const calls = updateMock.mock.calls as unknown as Array<[Record<string, unknown>]>;
    expect(calls[0][0].email).toBeUndefined();
  });

  describe('PATCH X-Correlation-Id lenient wiring (IAM-SRS-008)', () => {
    function patchReq(headers: Record<string, string>): never {
      return { headers, ip: '127.0.0.1', user: { sub: 'user-1', email: 'alice@example.com', roles: ['STAFF'] } } as unknown as never;
    }

    it('X-Correlation-Id hợp lệ được truyền vào updateProfile use case', async () => {
      const user = makeUser();
      const holder = { execute: jest.fn(async () => ({ entity: user })) };
      const ctrl = await bootModule(user, holder);
      await ctrl.updateProfileHandler({ fullName: 'Bob Tran' } as never, patchReq({ 'x-correlation-id': VALID_CORR }));
      expect(holder.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: VALID_CORR }));
    });

    it('self-service policy: X-Correlation-Id không phải UUID → correlationId undefined, KHÔNG 400/block', async () => {
      const user = makeUser();
      const holder = { execute: jest.fn(async () => ({ entity: user })) };
      const ctrl = await bootModule(user, holder);
      await ctrl.updateProfileHandler({ fullName: 'Bob Tran' } as never, patchReq({ 'x-correlation-id': 'not-a-uuid-123' }));
      expect(holder.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: undefined }));
    });

    it('thiếu X-Correlation-Id → correlationId undefined (best-effort, không block)', async () => {
      const user = makeUser();
      const holder = { execute: jest.fn(async () => ({ entity: user })) };
      const ctrl = await bootModule(user, holder);
      await ctrl.updateProfileHandler({ fullName: 'Bob Tran' } as never, patchReq({}));
      expect(holder.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: undefined }));
    });
  });
});
