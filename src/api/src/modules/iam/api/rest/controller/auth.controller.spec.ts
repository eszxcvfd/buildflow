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

describe('AuthController POST /api/v1/auth/login', () => {
  it('returns 200 shape via use-case', async () => {
    const mockUseCase = {
      execute: jest.fn(async () => ({
        accessToken: 'jwt-token',
        expiresAt: new Date('2026-08-27T13:00:00.000Z'),
        user: { id: 'u1', email: 'a@b.com', fullName: 'A B', status: 'ACTIVE', userType: 'STAFF' },
        roles: [{ id: 'r1', code: 'ADMIN', name: 'Admin' }],
        projectIds: ['p1'],
      })),
    };

    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: LoginUseCase, useValue: mockUseCase },
        { provide: LogoutUseCase, useValue: { execute: jest.fn() } },
        { provide: USER_REPOSITORY, useValue: {} },
        { provide: HASHER_PORT, useValue: {} },
        { provide: TOKEN_PORT, useValue: {} },
        { provide: TOKEN_REVOCATION_PORT, useValue: { isRevoked: jest.fn(async () => false), revoke: jest.fn() } },
        { provide: AUDIT_PORT, useValue: {} },
        { provide: JwtTokenService, useValue: { verify: jest.fn(async () => ({ sub: 'u1' })), sign: jest.fn() } },
        { provide: JwtAuthGuard, useValue: { canActivate: jest.fn(async () => true) } },
      ],
    }).compile();

    const ctrl = module.get(AuthController);
    const result = await ctrl.login(
      { email: 'a@b.com', password: 'Secret123!' } as unknown as never,
      { headers: {}, ip: '127.0.0.1' } as unknown as never,
    );

    expect(result.accessToken).toBe('jwt-token');
    expect(result.user.email).toBe('a@b.com');
    expect(mockUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({ email: 'a@b.com' }));
  });
});
