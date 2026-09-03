import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { LoginUseCase, GENERIC_INVALID_MSG, ACCOUNT_LOCKED_MSG } from './login.use-case';
import { USER_REPOSITORY } from '../../domain/repository/user.repository.port';
import { HASHER_PORT } from '../port/hasher.port';
import { TOKEN_PORT } from '../port/token.port';
import { AUDIT_PORT } from '../port/audit.port';
import { LOGIN_LIMITER_PORT } from '../port/login-limiter.port';
import type { UserSnapshot } from '../../domain/entity/user.entity';

function activeUser(overrides?: Partial<UserSnapshot>): UserSnapshot {
  return {
    id: 'u1',
    email: 'test@example.com',
    passwordHash: 'hashed',
    fullName: 'Test User',
    status: 'ACTIVE',
    failedLoginCount: 0,
    lockedUntil: null,
    ...overrides,
  };
}

describe('LoginUseCase IAM-SRS-001', () => {
  let useCase: LoginUseCase;
  let mockRepo: { findByEmail: jest.Mock; save: jest.Mock; findRolesByUserId: jest.Mock; findProjectIdsByUserId: jest.Mock };
  let mockHasher: { compare: jest.Mock };
  let mockToken: { sign: jest.Mock };
  let mockAudit: { log: jest.Mock };
  let mockLimiter: { isBlocked: jest.Mock; recordFailure: jest.Mock; reset: jest.Mock };
  let current: UserSnapshot;

  beforeEach(async () => {
    current = activeUser();
    mockRepo = {
      findByEmail: jest.fn(async () => current),
      save: jest.fn(async (u: UserSnapshot) => { current = u; }),
      findRolesByUserId: jest.fn(async () => [{ id: 'r1', code: 'WORKER', name: 'Worker' }]),
      findProjectIdsByUserId: jest.fn(async () => ['p1']),
    };
    mockHasher = { compare: jest.fn(async () => true) };
    mockToken = { sign: jest.fn(async () => ({ token: 'jwt-token', expiresAt: new Date(Date.now() + 3600_000) })) };
    mockAudit = { log: jest.fn(async () => {}) };
    mockLimiter = { isBlocked: jest.fn(async () => false), recordFailure: jest.fn(async () => {}), reset: jest.fn(async () => {}) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LoginUseCase,
        { provide: USER_REPOSITORY, useValue: mockRepo },
        { provide: HASHER_PORT, useValue: mockHasher },
        { provide: TOKEN_PORT, useValue: mockToken },
        { provide: AUDIT_PORT, useValue: mockAudit },
        { provide: LOGIN_LIMITER_PORT, useValue: mockLimiter },
      ],
    }).compile();
    useCase = moduleRef.get(LoginUseCase);
  });

  const baseInput = { email: 'test@example.com', password: 'Password123!' };

  it('đăng nhập thành công trả về token + roles + projectIds', async () => {
    const result = await useCase.execute(baseInput);
    expect(result.accessToken).toBe('jwt-token');
    expect(result.roles[0]?.code).toBe('WORKER');
    expect(result.projectIds).toEqual(['p1']);
    expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTH_LOGIN_SUCCESS', result: 'SUCCESS' }));
    expect(mockLimiter.reset).toHaveBeenCalled();
  });

  it('tài khoản không tồn tại trả 401 generic', async () => {
    mockRepo.findByEmail.mockResolvedValue(null);
    await expect(useCase.execute(baseInput)).rejects.toThrow(UnauthorizedException);
    await expect(useCase.execute(baseInput)).rejects.toThrow(GENERIC_INVALID_MSG);
  });

  it('tài khoản INACTIVE bị từ chối, không tạo phiên', async () => {
    current = activeUser({ status: 'INACTIVE' });
    await expect(useCase.execute(baseInput)).rejects.toThrow(GENERIC_INVALID_MSG);
  });

  it('tài khoản LOCKED vĩnh viễn trả 403 + locked msg', async () => {
    current = activeUser({ status: 'LOCKED', lockedUntil: null });
    await expect(useCase.execute(baseInput)).rejects.toThrow(ACCOUNT_LOCKED_MSG);
  });

  it('lockedUntil tương lai trả 403 dù status ACTIVE', async () => {
    current = activeUser({ lockedUntil: new Date(Date.now() + 600_000) });
    await expect(useCase.execute(baseInput)).rejects.toThrow(ACCOUNT_LOCKED_MSG);
  });

  it('sai mật khẩu → generic + failed count tăng + audit', async () => {
    mockHasher.compare.mockResolvedValue(false);
    await expect(useCase.execute(baseInput)).rejects.toThrow(GENERIC_INVALID_MSG);
    expect(current.failedLoginCount).toBe(1);
    expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ result: 'FAILED', afterData: expect.objectContaining({ reason: 'invalid_password' }) }));
    expect(mockLimiter.recordFailure).toHaveBeenCalled();
  });

  it('sai đủ 5 lần → tài khoản bị khóa', async () => {
    mockHasher.compare.mockResolvedValue(false);
    for (let i = 0; i < 5; i++) {
      await useCase.execute(baseInput).catch(() => undefined);
    }
    expect(current.status).toBe('LOCKED');
    expect(current.lockedUntil).not.toBeNull();
  });

  it('limiter bị block → 403 ngay cả trước khi query', async () => {
    mockLimiter.isBlocked.mockResolvedValue(true);
    await expect(useCase.execute(baseInput)).rejects.toThrow(ACCOUNT_LOCKED_MSG);
    expect(mockRepo.findByEmail).not.toHaveBeenCalled();
  });

  it('không ghi password/token vào audit', async () => {
    await useCase.execute(baseInput);
    const calls = mockAudit.log.mock.calls;
    for (const [params] of calls) {
      const json = JSON.stringify(params);
      expect(json).not.toContain('Password123!');
      expect(json).not.toContain('jwt-token');
    }
  });
});
