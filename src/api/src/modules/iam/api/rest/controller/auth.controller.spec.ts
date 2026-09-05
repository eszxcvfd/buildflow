import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { LoginUseCase } from '../../../application/use-case/login.use-case';
import { LogoutUseCase } from '../../../application/use-case/logout.use-case';
import { USER_REPOSITORY } from '../../../domain/repository/user-repository.port';
import { HASHER_PORT } from '../../../application/port/hasher.port';
import { TOKEN_PORT } from '../../../application/port/token.port';
import { TOKEN_REVOCATION_PORT } from '../../../application/port/token-revocation.port';
import { AUDIT_PORT } from '../../../application/port/audit.port';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { JwtTokenService } from '../../../infrastructure/security/jwt-token.service';

const VALID_CORR = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';

describe('AuthController POST /api/v1/auth/login + POST /api/v1/auth/logout (IAM-SRS-002/008)', () => {
  let mockUseCase: { execute: jest.Mock };
  let mockLogout: { execute: jest.Mock };
  let ctrl: AuthController;

  beforeEach(async () => {
    mockUseCase = {
      execute: jest.fn(async () => ({
        accessToken: 'jwt-token',
        expiresAt: new Date('2026-08-27T13:00:00.000Z'),
        user: { id: 'u1', email: 'a@b.com', fullName: 'A B', status: 'ACTIVE', userType: 'STAFF' },
        roles: [{ id: 'r1', code: 'ADMIN', name: 'Admin' }],
        projectIds: ['p1'],
      })),
    };
    mockLogout = { execute: jest.fn(async () => undefined) };

    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: LoginUseCase, useValue: mockUseCase },
        { provide: LogoutUseCase, useValue: mockLogout },
        { provide: USER_REPOSITORY, useValue: {} },
        { provide: HASHER_PORT, useValue: {} },
        { provide: TOKEN_PORT, useValue: {} },
        { provide: TOKEN_REVOCATION_PORT, useValue: { isRevoked: jest.fn(async () => false), revoke: jest.fn() } },
        { provide: AUDIT_PORT, useValue: {} },
        { provide: JwtTokenService, useValue: { verify: jest.fn(async () => ({ sub: 'u1' })), sign: jest.fn() } },
        { provide: JwtAuthGuard, useValue: { canActivate: jest.fn(async () => true) } },
      ],
    }).compile();

    ctrl = module.get(AuthController);
  });

  it('returns 200 shape via use-case', async () => {
    const result = await ctrl.login(
      { email: 'a@b.com', password: 'Secret123!' } as unknown as never,
      { headers: {}, ip: '127.0.0.1' } as unknown as never,
    );

    expect(result.accessToken).toBe('jwt-token');
    expect(result.user.email).toBe('a@b.com');
    expect(mockUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({ email: 'a@b.com' }));
  });

  it('X-Correlation-Id hợp lệ được truyền vào login use case (dedup theo (correlationId, action))', async () => {
    await ctrl.login(
      { email: 'a@b.com', password: 'Secret123!' } as unknown as never,
      { headers: { 'x-correlation-id': VALID_CORR }, ip: '127.0.0.1' } as unknown as never,
    );
    expect(mockUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: VALID_CORR }));
  });

  it('PUBLIC policy: X-Correlation-Id không phải UUID → correlationId undefined, KHÔNG 400/block', async () => {
    await ctrl.login(
      { email: 'a@b.com', password: 'Secret123!' } as unknown as never,
      { headers: { 'x-correlation-id': 'not-a-uuid-123' }, ip: '127.0.0.1' } as unknown as never,
    );
    expect(mockUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: undefined }));
  });

  it('PUBLIC policy: thiếu X-Correlation-Id → correlationId undefined (best-effort)', async () => {
    await ctrl.login(
      { email: 'a@b.com', password: 'Secret123!' } as unknown as never,
      { headers: {}, ip: '127.0.0.1' } as unknown as never,
    );
    expect(mockUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: undefined }));
  });

  describe('logout X-Correlation-Id lenient wiring (IAM-SRS-008)', () => {
    it('X-Correlation-Id hợp lệ được truyền vào logout use case (dedup theo (correlationId, action))', async () => {
      await ctrl.logout({ headers: { authorization: 'Bearer abc', 'x-correlation-id': VALID_CORR }, ip: '127.0.0.1' } as never);
      expect(mockLogout.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: VALID_CORR }));
    });

    it('PUBLIC policy: X-Correlation-Id không phải UUID → correlationId undefined, KHÔNG 400/block logout', async () => {
      await ctrl.logout({ headers: { authorization: 'Bearer abc', 'x-correlation-id': 'not-a-uuid-123' }, ip: '127.0.0.1' } as never);
      expect(mockLogout.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: undefined }));
    });

    it('thiếu X-Correlation-Id → correlationId undefined (best-effort, không block)', async () => {
      await ctrl.logout({ headers: { authorization: 'Bearer abc' }, ip: '127.0.0.1' } as never);
      expect(mockLogout.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: undefined }));
    });
  });
});
