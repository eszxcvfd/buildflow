import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtTokenService } from '../../../infrastructure/security/jwt-token.service';
import { InMemoryTokenRevocationService } from '../../../infrastructure/security/in-memory-token-revocation.service';

function mockContext(authHeader?: string): ExecutionContext {
  const req: Record<string, unknown> = { headers: { authorization: authHeader }, user: undefined };
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard IAM-SRS-002', () => {
  let guard: JwtAuthGuard;
  let tokenService: JwtTokenService;
  let revocation: InMemoryTokenRevocationService;
  // Configurable per test — NOT a fixed 'async () => null' stub.
  let getPasswordChangedAt: jest.Mock;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-guard-secret';
    process.env.JWT_EXPIRES_IN = '1h';
    tokenService = new JwtTokenService();
    revocation = new InMemoryTokenRevocationService();
    getPasswordChangedAt = jest.fn(async () => null);
    guard = new JwtAuthGuard(tokenService, revocation, { getPasswordChangedAt } as never);
  });

  it('cho phép request với token hợp lệ chưa bị thu hồi', async () => {
    const { token } = await tokenService.sign({ sub: 'u1', email: 'a@b.com', roles: ['WORKER'] });
    const ctx = mockContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect((ctx.switchToHttp().getRequest() as unknown as { user: { sub: string } }).user.sub).toBe('u1');
  });

  it('từ chối với 401 Phiên hết hạn khi token bị thu hồi', async () => {
    const { token } = await tokenService.sign({ sub: 'u1', email: 'a@b.com', roles: ['WORKER'] });
    const payload = await tokenService.verify(token);
    await revocation.revoke(payload.jti!, new Date(Date.now() + 3600 * 1000));
    const ctx = mockContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Phiên hết hạn, vui lòng đăng nhập lại');
  });

  it('từ chối khi thiếu Authorization header', async () => {
    const ctx = mockContext(undefined);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Phiên hết hạn, vui lòng đăng nhập lại');
  });

  it('từ chối khi token hết hạn', async () => {
    // Sign with 1s expiry and wait
    process.env.JWT_EXPIRES_IN = '1s';
    const localService = new JwtTokenService();
    const localRev = new InMemoryTokenRevocationService();
    const localGuard = new JwtAuthGuard(localService, localRev, { getPasswordChangedAt } as never);
    const { token } = await localService.sign({ sub: 'u1', email: 'a@b.com', roles: ['WORKER'] });
    await new Promise((r) => setTimeout(r, 1100));
    const ctx = mockContext(`Bearer ${token}`);
    await expect(localGuard.canActivate(ctx)).rejects.toThrow('Phiên hết hạn, vui lòng đăng nhập lại');
  });

  it('regression: từ chối 401 khi token hợp lệ nhưng thiếu jti (không thể thu hồi)', async () => {
    // Craft token without jti to simulate legacy/forged token
    const jwt = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET!;
    const token = jwt.sign({ sub: 'u1', email: 'a@b.com', roles: ['WORKER'] }, secret, { expiresIn: '1h' });
    const ctx = mockContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Phiên hết hạn, vui lòng đăng nhập lại');
  });
});

describe('JwtAuthGuard IAM-SRS-007 password-change cutoff', () => {
  let tokenService: JwtTokenService;
  let revocation: InMemoryTokenRevocationService;
  let getPasswordChangedAt: jest.Mock;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-guard-secret';
    process.env.JWT_EXPIRES_IN = '1h';
    tokenService = new JwtTokenService();
    revocation = new InMemoryTokenRevocationService();
    getPasswordChangedAt = jest.fn(async () => null);
    guard = new JwtAuthGuard(tokenService, revocation, { getPasswordChangedAt } as never);
  });

  it('cutoff SAU token iat (mật khẩu đổi sau khi phát token) → canActivate false (401)', async () => {
    const { token } = await tokenService.sign({ sub: 'cut-1', email: 'a@b.com', roles: ['WORKER'] });
    const payload = await tokenService.verify(token);
    // password_changed_at nằm SAU thời điểm phát token → phiên cũ phải chết
    getPasswordChangedAt.mockResolvedValue(new Date((payload.iat! + 5) * 1000));
    const ctx = mockContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(getPasswordChangedAt).toHaveBeenCalledWith('cut-1');
  });

  it('regression: cutoff TRONG CÙNG GIÂY với iat (ms muộn hơn) → canActivate true (1-giây acceptance window)', async () => {
    const { token } = await tokenService.sign({ sub: 'cut-same', email: 'a@b.com', roles: ['WORKER'] });
    const payload = await tokenService.verify(token);
    // password_changed_at = iat*1000 + 500ms: token đúc cùng giây, ngay trước cutoff
    // theo ms — không được từ chối nhầm (fix race đúc token cùng giây đổi mật khẩu).
    getPasswordChangedAt.mockResolvedValue(new Date(payload.iat! * 1000 + 500));
    const ctx = mockContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('regression: cutoff một giây SAU iat (second-precision biên) → canActivate false (401)', async () => {
    const { token } = await tokenService.sign({ sub: 'cut-prev', email: 'a@b.com', roles: ['WORKER'] });
    const payload = await tokenService.verify(token);
    // password_changed_at = giây (iat+1): iat < floor(cutoffMs/1000) → phiên phát trước
    // cutoff (đúng 1 giây) phải bị từ chối.
    getPasswordChangedAt.mockResolvedValue(new Date((payload.iat! + 1) * 1000));
    const ctx = mockContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('cutoff TRƯỚC token iat (token phát sau khi đổi mật khẩu) → canActivate true', async () => {
    const { token } = await tokenService.sign({ sub: 'cut-2', email: 'a@b.com', roles: ['WORKER'] });
    const payload = await tokenService.verify(token);
    getPasswordChangedAt.mockResolvedValue(new Date((payload.iat! - 5) * 1000));
    const ctx = mockContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('cutoff TRÙNG CHÍNH XÁC iat ms (biên: chỉ token phát TRƯỚC cutoff mới chết) → canActivate true', async () => {
    const { token } = await tokenService.sign({ sub: 'cut-3', email: 'a@b.com', roles: ['WORKER'] });
    const payload = await tokenService.verify(token);
    getPasswordChangedAt.mockResolvedValue(new Date(payload.iat! * 1000));
    const ctx = mockContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('token thiếu iat + có cutoff → fail-closed: 401', async () => {
    const jwt = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET!;
    const token = jwt.sign(
      { sub: 'cut-4', email: 'a@b.com', roles: ['WORKER'], jti: 'manual-jti-cut4' },
      secret,
      { expiresIn: '1h', noTimestamp: true },
    );
    getPasswordChangedAt.mockResolvedValue(new Date(Date.now() - 60_000)); // cutoff trong quá khứ vẫn từ chối
    const ctx = mockContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('token thiếu iat nhưng KHÔNG có cutoff → cho phép (không áp dụng cutoff)', async () => {
    const jwt = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET!;
    const token = jwt.sign(
      { sub: 'cut-5', email: 'a@b.com', roles: ['WORKER'], jti: 'manual-jti-cut5' },
      secret,
      { expiresIn: '1h', noTimestamp: true },
    );
    getPasswordChangedAt.mockResolvedValue(null);
    const ctx = mockContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('không gọi cutoff khi user chưa từng đổi mật khẩu (getPasswordChangedAt null)', async () => {
    const { token } = await tokenService.sign({ sub: 'cut-6', email: 'a@b.com', roles: ['WORKER'] });
    const ctx = mockContext(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(getPasswordChangedAt).toHaveBeenCalledTimes(1);
  });
});
