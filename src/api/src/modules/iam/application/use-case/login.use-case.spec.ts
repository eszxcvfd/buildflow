import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { LoginUseCase } from './login.use-case';
import { UserEntity } from '../../domain/entity/user.entity';
import { UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { HasherPort } from '../port/hasher.port';
import { TokenPort } from '../port/token.port';
import { AuditPort } from '../port/audit.port';

function makeUser(overrides: Partial<ReturnType<UserEntity['getProps']>> = {}): UserEntity {
  return new UserEntity({
    id: 'user-1',
    email: 'alice@example.com',
    passwordHash: bcrypt.hashSync('Secret123!', 10),
    fullName: 'Alice Nguyen',
    status: 'ACTIVE',
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    userType: 'STAFF',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ReturnType<UserEntity['getProps']>);
}

describe('LoginUseCase IAM-SRS-001', () => {
  let userEntity: UserEntity | null;
  let repo: jest.Mocked<UserRepositoryPort>;
  let hasher: HasherPort;
  let tokenPort: jest.Mocked<TokenPort>;
  let audit: jest.Mocked<AuditPort>;
  let useCase: LoginUseCase;

  beforeEach(() => {
    userEntity = null;
    repo = {
      findByEmail: jest.fn(async (email: string) => userEntity && userEntity.email.toLowerCase() === email.toLowerCase() ? userEntity : null),
      findById: jest.fn(async () => userEntity),
      save: jest.fn(async (u: UserEntity) => { userEntity = u; }),
      findActiveRolesByUserId: jest.fn(async () => [{ id: 'r1', code: 'ADMIN', name: 'Admin' }]),
      findActiveProjectIdsByUserId: jest.fn(async () => ['proj-1']),
    } as unknown as jest.Mocked<UserRepositoryPort>;

    hasher = {
      hash: async (p: string) => bcrypt.hash(p, 10),
      compare: async (plain: string, hash: string) => bcrypt.compare(plain, hash),
    };

    tokenPort = {
      sign: jest.fn(async (payload) => ({ token: `jwt-${payload.sub}`, expiresAt: new Date(Date.now() + 3600 * 1000) })),
      verify: jest.fn(async () => ({ sub: 'user-1', email: 'alice@example.com', roles: ['ADMIN'] })),
    } as unknown as jest.Mocked<TokenPort>;

    audit = {
      log: jest.fn(async () => {}),
    } as unknown as jest.Mocked<AuditPort>;

    // ensure env for config
    process.env.JWT_SECRET = 'test-secret';
    process.env.LOGIN_MAX_FAILED_ATTEMPTS = '5';
    process.env.LOGIN_LOCK_DURATION_MINUTES = '15';

    useCase = new LoginUseCase(repo, hasher, tokenPort, audit);
  });

  it('đăng nhập thành công trả về token + roles + projectIds (UC-01)', async () => {
    userEntity = makeUser();
    const out = await useCase.execute({ email: 'alice@example.com', password: 'Secret123!' });
    expect(out.accessToken).toBe('jwt-user-1');
    expect(out.user.email).toBe('alice@example.com');
    expect(out.roles).toHaveLength(1);
    expect(out.projectIds).toEqual(['proj-1']);
    expect(repo.save).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTH_LOGIN_SUCCESS', result: 'SUCCESS' }));
  });

  it('tài khoản bị khóa (status LOCKED) bị từ chối với Forbidden', async () => {
    userEntity = makeUser({ status: 'LOCKED' });
    await expect(useCase.execute({ email: 'alice@example.com', password: 'Secret123!' })).rejects.toThrow(ForbiddenException);
    await expect(useCase.execute({ email: 'alice@example.com', password: 'Secret123!' })).rejects.toThrow('Tài khoản đang bị khóa');
  });

  it('tài khoản INACTIVE bị từ chối với Forbidden và nêu trạng thái', async () => {
    userEntity = makeUser({ status: 'INACTIVE' });
    await expect(useCase.execute({ email: 'alice@example.com', password: 'Secret123!' })).rejects.toThrow(ForbiddenException);
    await expect(useCase.execute({ email: 'alice@example.com', password: 'Secret123!' })).rejects.toThrow('Tài khoản đã ngừng hoạt động');
  });

  it('lockedUntil trong tương lai bị từ chối dù status ACTIVE', async () => {
    userEntity = makeUser({ lockedUntil: new Date(Date.now() + 10 * 60 * 1000) });
    await expect(useCase.execute({ email: 'alice@example.com', password: 'Secret123!' })).rejects.toThrow(ForbiddenException);
  });

  it('thông báo lỗi không tiết lộ tài khoản có tồn tại (non-existent)', async () => {
    userEntity = null;
    // repo.findByEmail will return null when no entity or email mismatch
    (repo.findByEmail as jest.Mock) = jest.fn(async () => null);
    await expect(useCase.execute({ email: 'unknown@example.com', password: 'whatever' })).rejects.toThrow(UnauthorizedException);
    await expect(useCase.execute({ email: 'unknown@example.com', password: 'whatever' })).rejects.toThrow('Thông tin đăng nhập không hợp lệ');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ result: 'FAILED' }));
  });

  it('IAM-SRS-008: user không tồn tại → AUTH_LOGIN_FAILED traceable an toàn (actor null, không plaintext password)', async () => {
    userEntity = null;
    (repo.findByEmail as jest.Mock) = jest.fn(async () => null);
    await expect(
      useCase.execute({ email: 'ghost@example.com', password: 'PlaintextLeak123!' }),
    ).rejects.toThrow(UnauthorizedException);

    expect(audit.log).toHaveBeenCalledTimes(1);
    const call = (audit.log as jest.Mock).mock.calls[0][0];
    expect(call.action).toBe('AUTH_LOGIN_FAILED');
    expect(call.actorUserId).toBeNull();
    expect(call.entityId).toBeNull();
    expect(call.result).toBe('FAILED');
    expect(call.afterData).toEqual({ email: 'ghost@example.com', reason: 'user_not_found' });
    expect(call.correlationId).toBeNull();
    // the attempted password and any password key must never reach audit metadata
    const serialized = JSON.stringify(call);
    expect(serialized).not.toContain('PlaintextLeak123!');
    expect(serialized.toLowerCase()).not.toContain('"password"');
  });

  it('sai mật khẩu → từ chối generic + tăng failed count', async () => {
    userEntity = makeUser({ failedLoginCount: 0 });
    await expect(useCase.execute({ email: 'alice@example.com', password: 'wrong' })).rejects.toThrow(UnauthorizedException);
    expect(userEntity!.failedLoginCount).toBe(1);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ afterData: expect.objectContaining({ reason: 'invalid_password' }) }));
  });

  it('sai 5 lần liên tiếp → khóa tài khoản và lần sau trả Forbidden LOCKED', async () => {
    userEntity = makeUser({ failedLoginCount: 4 });
    // 5th failure should lock
    await expect(useCase.execute({ email: 'alice@example.com', password: 'wrong' })).rejects.toThrow(ForbiddenException);
    expect(userEntity!.status).toBe('LOCKED');
    expect(userEntity!.lockedUntil).not.toBeNull();
    // next attempt even with correct password should be locked
    await expect(useCase.execute({ email: 'alice@example.com', password: 'Secret123!' })).rejects.toThrow('Tài khoản đang bị khóa');
  });

  it('sau đăng nhập thành công chỉ thấy chức năng thuộc quyền (roles)', async () => {
    userEntity = makeUser();
    (repo.findActiveRolesByUserId as jest.Mock) = jest.fn(async () => [{ id: 'r2', code: 'WORKER', name: 'Worker' }]);
    const out = await useCase.execute({ email: 'alice@example.com', password: 'Secret123!' });
    expect(out.roles[0].code).toBe('WORKER');
    expect(tokenPort.sign).toHaveBeenCalledWith(expect.objectContaining({ roles: ['WORKER'] }));
  });

  it('case-insensitive email và trim', async () => {
    userEntity = makeUser();
    const out = await useCase.execute({ email: '  ALICE@Example.COM  ', password: 'Secret123!' });
    expect(out.user.email).toBe('alice@example.com');
  });

  it('manual LOCKED không expiry vẫn bị khóa vĩnh viễn (không auto-unlock)', async () => {
    // Khóa thủ công: status LOCKED và lockedUntil null -> isCurrentlyLocked true mãi
    userEntity = makeUser({ status: 'LOCKED', lockedUntil: null });
    expect(userEntity.isCurrentlyLocked()).toBe(true);
    expect(userEntity.isCurrentlyLocked(new Date(Date.now() + 24 * 60 * 60 * 1000))).toBe(true);
    await expect(useCase.execute({ email: 'alice@example.com', password: 'Secret123!' })).rejects.toThrow('Tài khoản đang bị khóa');
    // clearExpiredLock should not clear manual lock
    expect(userEntity.clearExpiredLock(new Date(Date.now() + 60 * 60 * 1000))).toBe(false);
    expect(userEntity.status).toBe('LOCKED');
  });

  it('auto-lock hết hạn 15 phút cho phép đăng nhập lại (fix review)', async () => {
    // Giả lập auto-lock: status LOCKED + lockedUntil trong quá khứ (đã hết hạn 1 phút)
    const pastLockedUntil = new Date(Date.now() - 1 * 60 * 1000);
    userEntity = makeUser({ status: 'LOCKED', lockedUntil: pastLockedUntil, failedLoginCount: 5 });
    // isCurrentlyLocked phải false sau khi hết hạn
    expect(userEntity.isCurrentlyLocked()).toBe(false);
    // Login với mật khẩu đúng phải thành công (auto-unlock)
    const out = await useCase.execute({ email: 'alice@example.com', password: 'Secret123!' });
    expect(out.accessToken).toBe('jwt-user-1');
    expect(userEntity.status).toBe('ACTIVE');
    expect(userEntity.lockedUntil).toBeNull();
    expect(userEntity.failedLoginCount).toBe(0);
  });

  it('sau khi hết hạn, đếm lỗi reset và không khóa lại ngay với 1 lần sai', async () => {
    const pastLockedUntil = new Date(Date.now() - 2 * 60 * 1000);
    userEntity = makeUser({ status: 'LOCKED', lockedUntil: pastLockedUntil, failedLoginCount: 5 });
    // Sai mật khẩu sau khi hết hạn -> chỉ tăng lên 1, không khóa ngay
    await expect(useCase.execute({ email: 'alice@example.com', password: 'wrong' })).rejects.toThrow(UnauthorizedException);
    expect(userEntity.failedLoginCount).toBe(1);
    expect(userEntity.status).toBe('ACTIVE');
    expect(userEntity.lockedUntil).toBeNull();
    // Không bị khóa, vẫn có thể thử lại
    expect(userEntity.isCurrentlyLocked()).toBe(false);
  });

  it('UserEntity.isCurrentlyLocked phân biệt manual vs auto-lock', () => {
    const now = new Date();
    const future = new Date(now.getTime() + 10 * 60 * 1000);
    const past = new Date(now.getTime() - 10 * 60 * 1000);

    // manual
    expect(makeUser({ status: 'LOCKED', lockedUntil: null }).isCurrentlyLocked(now)).toBe(true);
    // auto-lock còn hạn
    expect(makeUser({ status: 'LOCKED', lockedUntil: future }).isCurrentlyLocked(now)).toBe(true);
    expect(makeUser({ status: 'ACTIVE', lockedUntil: future }).isCurrentlyLocked(now)).toBe(true);
    // auto-lock hết hạn
    expect(makeUser({ status: 'LOCKED', lockedUntil: past }).isCurrentlyLocked(now)).toBe(false);
    expect(makeUser({ status: 'ACTIVE', lockedUntil: past }).isCurrentlyLocked(now)).toBe(false);
    // active không lock
    expect(makeUser({ status: 'ACTIVE', lockedUntil: null }).isCurrentlyLocked(now)).toBe(false);
    // clearExpiredLock behavior
    const expired = makeUser({ status: 'LOCKED', lockedUntil: past, failedLoginCount: 5 });
    expect(expired.clearExpiredLock(now)).toBe(true);
    expect(expired.status).toBe('ACTIVE');
    expect(expired.lockedUntil).toBeNull();
    expect(expired.failedLoginCount).toBe(0);
  });

  it('IAM-SRS-008: correlationId hợp lệ được đưa vào audit payload AUTH_LOGIN_SUCCESS và AUTH_LOGIN_FAILED', async () => {
    const corr = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';
    userEntity = makeUser();
    await useCase.execute({ email: 'alice@example.com', password: 'Secret123!', correlationId: corr });
    expect(audit.log).toHaveBeenCalledTimes(1);
    const success = (audit.log as jest.Mock).mock.calls[0][0];
    expect(success.action).toBe('AUTH_LOGIN_SUCCESS');
    expect(success.correlationId).toBe(corr);

    // failed branch (sai mật khẩu) cũng mang cùng correlationId
    (audit.log as jest.Mock).mockClear();
    await expect(
      useCase.execute({ email: 'alice@example.com', password: 'wrong', correlationId: corr }),
    ).rejects.toThrow(UnauthorizedException);
    const failed = (audit.log as jest.Mock).mock.calls[0][0];
    expect(failed.action).toBe('AUTH_LOGIN_FAILED');
    expect(failed.correlationId).toBe(corr);
  });

  it('IAM-SRS-008: correlationId không hợp lệ/absent ở controller → undefined → audit payload correlationId null', async () => {
    // Absent
    userEntity = makeUser();
    await useCase.execute({ email: 'alice@example.com', password: 'Secret123!' });
    let call = (audit.log as jest.Mock).mock.calls[0][0];
    expect(call.correlationId).toBeNull();

    // Invalid (controller lenient: không 400, truyền undefined xuống use case)
    (audit.log as jest.Mock).mockClear();
    await useCase.execute({ email: 'alice@example.com', password: 'Secret123!', correlationId: undefined });
    call = (audit.log as jest.Mock).mock.calls[0][0];
    expect(call.correlationId).toBeNull();
  });
});
