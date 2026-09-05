import { Test } from '@nestjs/testing';
import { PasswordController } from './password.controller';
import { ChangePasswordUseCase } from '../../../application/use-case/change-password.use-case';
import { RequestPasswordResetUseCase } from '../../../application/use-case/request-password-reset.use-case';
import { ResetPasswordUseCase } from '../../../application/use-case/reset-password.use-case';
import { USER_REPOSITORY } from '../../../domain/repository/user-repository.port';
import { HASHER_PORT } from '../../../application/port/hasher.port';
import { TOKEN_PORT } from '../../../application/port/token.port';
import { TOKEN_REVOCATION_PORT } from '../../../application/port/token-revocation.port';
import { AUDIT_PORT } from '../../../application/port/audit.port';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { JwtTokenService } from '../../../infrastructure/security/jwt-token.service';

const VALID_CORR = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';

describe('PasswordController — X-Correlation-Id lenient wiring (IAM-SRS-007/008)', () => {
  let changeMock: { execute: jest.Mock };
  let requestMock: { execute: jest.Mock };
  let confirmMock: { execute: jest.Mock };
  let ctrl: PasswordController;

  beforeEach(async () => {
    changeMock = { execute: jest.fn(async () => ({ reauthRequired: true, passwordChangedAt: new Date() })) };
    requestMock = { execute: jest.fn(async () => ({ message: 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.' })) };
    confirmMock = { execute: jest.fn(async () => ({ reauthRequired: true })) };

    const module = await Test.createTestingModule({
      controllers: [PasswordController],
      providers: [
        { provide: ChangePasswordUseCase, useValue: changeMock },
        { provide: RequestPasswordResetUseCase, useValue: requestMock },
        { provide: ResetPasswordUseCase, useValue: confirmMock },
        { provide: USER_REPOSITORY, useValue: {} },
        { provide: HASHER_PORT, useValue: {} },
        { provide: TOKEN_PORT, useValue: {} },
        { provide: TOKEN_REVOCATION_PORT, useValue: { isRevoked: jest.fn(async () => false), revoke: jest.fn() } },
        { provide: AUDIT_PORT, useValue: {} },
        { provide: JwtTokenService, useValue: { verify: jest.fn(async () => ({ sub: 'u1' })), sign: jest.fn() } },
        { provide: JwtAuthGuard, useValue: { canActivate: jest.fn(async () => true) } },
      ],
    }).compile();

    ctrl = module.get(PasswordController);
  });

  function reqWith(headers: Record<string, string>): never {
    return { headers, ip: '127.0.0.1' } as unknown as never;
  }

  function authedReqWith(headers: Record<string, string>): never {
    return { headers, ip: '127.0.0.1', user: { sub: 'u1', email: 'a@b.com', roles: ['WORKER'] } } as unknown as never;
  }

  describe('request-password-reset (public, lenient)', () => {
    it('X-Correlation-Id hợp lệ → forwarded vào use case', async () => {
      await ctrl.requestReset({ email: 'a@b.com' } as never, reqWith({ 'x-correlation-id': VALID_CORR }));
      expect(requestMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: VALID_CORR }));
    });

    it('không phải UUID → correlationId undefined, KHÔNG 400/block', async () => {
      await ctrl.requestReset({ email: 'a@b.com' } as never, reqWith({ 'x-correlation-id': 'not-a-uuid' }));
      expect(requestMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: undefined }));
    });

    it('thiếu header → correlationId undefined (best-effort)', async () => {
      await ctrl.requestReset({ email: 'a@b.com' } as never, reqWith({}));
      expect(requestMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: undefined }));
    });
  });

  describe('reset-password confirm (public, lenient)', () => {
    it('X-Correlation-Id hợp lệ → forwarded vào use case', async () => {
      await ctrl.confirmReset({ token: 't', newPassword: 'NewPass99', confirmPassword: 'NewPass99' } as never, reqWith({ 'x-correlation-id': VALID_CORR }));
      expect(confirmMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: VALID_CORR }));
    });

    it('không phải UUID → correlationId undefined, KHÔNG 400/block', async () => {
      await ctrl.confirmReset({ token: 't', newPassword: 'NewPass99', confirmPassword: 'NewPass99' } as never, reqWith({ 'x-correlation-id': 'not-a-uuid' }));
      expect(confirmMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: undefined }));
    });

    it('thiếu header → correlationId undefined (best-effort)', async () => {
      await ctrl.confirmReset({ token: 't', newPassword: 'NewPass99', confirmPassword: 'NewPass99' } as never, reqWith({}));
      expect(confirmMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: undefined }));
    });
  });

  describe('change-password (self-service PATCH /me/password, lenient)', () => {
    it('X-Correlation-Id hợp lệ → forwarded vào use case', async () => {
      await ctrl.changePassword({ currentPassword: 'Current1', newPassword: 'NewPass99', confirmPassword: 'NewPass99' } as never, authedReqWith({ 'x-correlation-id': VALID_CORR }));
      expect(changeMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: VALID_CORR }));
    });

    it('không phải UUID → correlationId undefined, KHÔNG 400/block', async () => {
      await ctrl.changePassword({ currentPassword: 'Current1', newPassword: 'NewPass99', confirmPassword: 'NewPass99' } as never, authedReqWith({ 'x-correlation-id': 'not-a-uuid' }));
      expect(changeMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: undefined }));
    });

    it('thiếu header → correlationId undefined (best-effort)', async () => {
      await ctrl.changePassword({ currentPassword: 'Current1', newPassword: 'NewPass99', confirmPassword: 'NewPass99' } as never, authedReqWith({}));
      expect(changeMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: undefined }));
    });
  });
});