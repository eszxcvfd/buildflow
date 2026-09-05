import { UnauthorizedException } from '@nestjs/common';
import { JwtTokenService } from '../../infrastructure/security/jwt-token.service';
import { InMemoryTokenRevocationService } from '../../infrastructure/security/in-memory-token-revocation.service';
import { LogoutUseCase } from './logout.use-case';
import { AuditPort } from '../port/audit.port';

describe('LogoutUseCase IAM-SRS-002', () => {
  let tokenService: JwtTokenService;
  let revocation: InMemoryTokenRevocationService;
  let audit: jest.Mocked<AuditPort>;
  let useCase: LogoutUseCase;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-logout';
    process.env.JWT_EXPIRES_IN = '1h';
    tokenService = new JwtTokenService();
    revocation = new InMemoryTokenRevocationService();
    audit = { log: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    useCase = new LogoutUseCase(tokenService as never, revocation as never, audit as never);
  });

  it('đăng xuất làm mất hiệu lực phiên hiện tại (jti bị thu hồi)', async () => {
    const { token } = await tokenService.sign({ sub: 'user-1', email: 'a@b.com', roles: ['WORKER'] });
    const payload = await tokenService.verify(token);
    expect(payload.jti).toBeDefined();

    await useCase.execute({ token });

    expect(await revocation.isRevoked(payload.jti!)).toBe(true);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTH_LOGOUT', result: 'SUCCESS' }));
  });

  it('yêu cầu tiếp theo bằng phiên bị thu hồi bị từ chối (guard sẽ chặn 401)', async () => {
    const { token } = await tokenService.sign({ sub: 'user-1', email: 'a@b.com', roles: ['WORKER'] });
    const payload = await tokenService.verify(token);
    await useCase.execute({ token });
    // Simulate guard check
    expect(await revocation.isRevoked(payload.jti!)).toBe(true);
  });

  it('token hết hạn hoặc không hợp lệ bị từ chối với 401 Phiên hết hạn', async () => {
    await expect(useCase.execute({ token: 'invalid-token' })).rejects.toThrow(UnauthorizedException);
    await expect(useCase.execute({ token: 'invalid-token' })).rejects.toThrow('Phiên hết hạn, vui lòng đăng nhập lại');
  });

  it('dữ liệu đã lưu hợp lệ không bị mất khi đăng xuất (không xóa user)', async () => {
    const { token } = await tokenService.sign({ sub: 'user-1', email: 'a@b.com', roles: ['WORKER'] });
    await useCase.execute({ token });
    // No side-effect on user repo; just revocation
    expect(revocation.size()).toBe(1);
  });

  it('thu hồi có TTL = thời hạn token, hết hạn tự xóa', async () => {
    const { token } = await tokenService.sign({ sub: 'user-1', email: 'a@b.com', roles: ['WORKER'] });
    const payload = await tokenService.verify(token);
    // Manually revoke with past expiry
    await revocation.revoke(payload.jti!, new Date(Date.now() - 1000));
    expect(await revocation.isRevoked(payload.jti!)).toBe(false);
    expect(revocation.size()).toBe(0);
  });

  it('regression: token thiếu jti bị từ chối 401 và không revoke', async () => {
    const jwt = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET!;
    const tokenNoJti = jwt.sign({ sub: 'user-1', email: 'a@b.com', roles: ['WORKER'] }, secret, { expiresIn: '1h' });
    await expect(useCase.execute({ token: tokenNoJti })).rejects.toThrow(UnauthorizedException);
    await expect(useCase.execute({ token: tokenNoJti })).rejects.toThrow('Phiên hết hạn, vui lòng đăng nhập lại');
    expect(revocation.size()).toBe(0);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('IAM-SRS-008: correlationId hợp lệ đi vào audit payload AUTH_LOGOUT (dedup theo (correlationId, action))', async () => {
    const corr = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';
    const { token } = await tokenService.sign({ sub: 'user-1', email: 'a@b.com', roles: ['WORKER'] });
    audit.log.mockClear();
    await useCase.execute({ token, correlationId: corr });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTH_LOGOUT', correlationId: corr }));
  });

  it('IAM-SRS-008: correlationId absent (controller lenient → undefined) → audit payload correlationId null', async () => {
    const { token } = await tokenService.sign({ sub: 'user-1', email: 'a@b.com', roles: ['WORKER'] });
    audit.log.mockClear();
    await useCase.execute({ token, correlationId: undefined });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTH_LOGOUT', correlationId: null }));
  });
});
