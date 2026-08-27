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

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-guard-secret';
    process.env.JWT_EXPIRES_IN = '1h';
    tokenService = new JwtTokenService();
    revocation = new InMemoryTokenRevocationService();
    guard = new JwtAuthGuard(tokenService, revocation);
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
    const localGuard = new JwtAuthGuard(localService, localRev);
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
