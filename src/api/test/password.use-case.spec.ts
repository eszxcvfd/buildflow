import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { validatePasswordPolicy } from '../src/modules/iam/domain/service/password.policy';
import { ChangePasswordUseCase } from '../src/modules/iam/application/use-case/change-password.use-case';
import { RequestPasswordResetUseCase } from '../src/modules/iam/application/use-case/request-password-reset.use-case';
import { ResetPasswordUseCase } from '../src/modules/iam/application/use-case/reset-password.use-case';
import { ChangePasswordDto, ResetPasswordDto } from '../src/modules/iam/api/rest/presentation/dto/password.dto';

describe('IAM-SRS-007 password policy', () => {
  it('chấp nhận mật khẩu đạt policy', () => {
    expect(validatePasswordPolicy('Abcdef12').ok).toBe(true);
  });
  it('từ chối thiếu chữ số', () => {
    const r = validatePasswordPolicy('Abcdefgh');
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('chữ số');
  });
  it('từ chối ngắn hơn 8 ký tự', () => {
    expect(validatePasswordPolicy('Ab1').ok).toBe(false);
  });
});

describe('IAM-SRS-007 DTO: confirmPassword bắt buộc (contract Web/Mobile)', () => {
  it('ChangePasswordDto thiếu confirmPassword → validation lỗi field confirmPassword', async () => {
    const dto = plainToInstance(ChangePasswordDto, { currentPassword: 'Current1', newPassword: 'NewPass99' });
    const errors = await validate(dto);
    const fields = errors.map((e) => e.property);
    expect(fields).toContain('confirmPassword');
    expect(fields).not.toContain('currentPassword');
    expect(fields).not.toContain('newPassword');
  });

  it('ChangePasswordDto confirmPassword sai kiểu (số) → lỗi, không được bỏ qua', async () => {
    const dto = plainToInstance(ChangePasswordDto, { currentPassword: 'Current1', newPassword: 'NewPass99', confirmPassword: 12345678 });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain('confirmPassword');
  });

  it('ChangePasswordDto đủ 3 field hợp lệ → không lỗi', async () => {
    const dto = plainToInstance(ChangePasswordDto, { currentPassword: 'Current1', newPassword: 'NewPass99', confirmPassword: 'NewPass99' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('ResetPasswordDto thiếu confirmPassword → validation lỗi field confirmPassword', async () => {
    const dto = plainToInstance(ResetPasswordDto, { token: 'validtoken123', newPassword: 'NewPass99' });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain('confirmPassword');
    expect(errors.map((e) => e.property)).not.toContain('token');
  });

  it('ResetPasswordDto confirmPassword ngắn hơn 8 ký tự → lỗi với message tiếng VN', async () => {
    const dto = plainToInstance(ResetPasswordDto, { token: 'validtoken123', newPassword: 'NewPass99', confirmPassword: 'short' });
    const errors = await validate(dto);
    const confirmError = errors.find((e) => e.property === 'confirmPassword');
    expect(confirmError).toBeDefined();
    expect(JSON.stringify(confirmError?.constraints)).toContain('Xác nhận mật khẩu');
  });
});

const CURRENT_PASSWORD = 'Current1';
const NEW_PASSWORD = 'NewPass99';
const RESET_TOKEN = 'validtoken123abcdef';

function makeDeps(overrides: Record<string, Record<string, unknown>> = {}) {
  const userEntity = {
    id: 'u1',
    passwordHash: '$2a$10$abcdefghijabcdefghijabcdefghijabcdefghijabcdefghij12',
    isActive: () => true,
  };
  const deps = {
    userEntity,
    userRepo: {
      findById: async () => userEntity,
      findByEmail: async () => userEntity,
      updatePasswordHash: async () => 1,
      getPasswordChangedAt: async () => null,
    },
    resetRepo: {
      create: async () => ({ id: 't1' }),
      findLatestUsableByHash: async () => ({ id: 't1', userId: 'u1', tokenHash: 'h', expiresAt: new Date(Date.now() + 60000), usedAt: null, createdAt: new Date() }),
      invalidateAllForUser: async () => 1,
      deleteExpired: jest.fn(async () => 0),
    },
    hasher: { hash: async (p: string) => 'hashed:' + p, compare: async (p: string) => p === CURRENT_PASSWORD },
    tokenPort: {},
    revocation: { revokeAllForUserBefore: async () => undefined, isRevoked: async () => false, revoke: async () => undefined, isUserRevokedBefore: async () => false },
    audit: { log: jest.fn(async () => undefined), logWithClient: jest.fn(async () => undefined) },
    tx: { withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({ query: async () => ({ rowCount: 1 }) })) },
  };
  if (overrides.userRepo) Object.assign(deps.userRepo as Record<string, unknown>, overrides.userRepo);
  if (overrides.resetRepo) Object.assign(deps.resetRepo as Record<string, unknown>, overrides.resetRepo);
  if (overrides.hasher) Object.assign(deps.hasher as Record<string, unknown>, overrides.hasher);
  if (overrides.revocation) Object.assign(deps.revocation as Record<string, unknown>, overrides.revocation);
  return deps;
}

type Deps = ReturnType<typeof makeDeps>;

/** JSON of every audit call — used to prove no secret material is ever logged. */
function auditCallsJson(d: Deps): string {
  const log = d.audit.log as unknown as jest.Mock;
  const logWithClient = d.audit.logWithClient as unknown as jest.Mock;
  return JSON.stringify([...log.mock.calls, ...logWithClient.mock.calls]);
}

describe('IAM-SRS-007 ChangePasswordUseCase', () => {
  it('từ chối current password sai → 400 kèm field error currentPassword, không đổi dữ liệu', async () => {
    const d = makeDeps();
    let saved = false;
    (d.userRepo as Record<string, unknown>).updatePasswordHash = async () => { saved = true; return 1; };
    const uc = new ChangePasswordUseCase(d.userRepo as never, d.resetRepo as never, d.hasher as never, d.tokenPort as never, d.revocation as never, d.audit as never, d.tx as never);
    const err: unknown = await uc.execute({ userId: 'u1', currentPassword: 'Wrong1x', newPassword: NEW_PASSWORD }).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    const response = (err as { getResponse: () => { message: string; errors?: Record<string, string> } }).getResponse();
    expect(response.message).toContain('Mật khẩu hiện tại không đúng');
    expect(response.errors?.currentPassword).toContain('Mật khẩu hiện tại không đúng');
    expect(saved).toBe(false);
    const log = d.audit.log as unknown as jest.Mock;
    expect(log.mock.calls[0][0].result).toBe('FAILED');
    // Audit không được chứa plaintext mật khẩu
    expect(auditCallsJson(d)).not.toContain('Wrong1x');
    expect(auditCallsJson(d)).not.toContain(NEW_PASSWORD);
  });

  it('từ chối policy không đạt', async () => {
    const d = makeDeps();
    const uc = new ChangePasswordUseCase(d.userRepo as never, d.resetRepo as never, d.hasher as never, d.tokenPort as never, d.revocation as never, d.audit as never, d.tx as never);
    await expect(uc.execute({ userId: 'u1', currentPassword: CURRENT_PASSWORD, newPassword: 'allletters' })).rejects.toThrow(BadRequestException);
    expect(auditCallsJson(d)).not.toContain('allletters');
  });

  it('đổi thành công, hash mới không plaintext, cutoff revoked', async () => {
    const d = makeDeps();
    const saved: string[] = [];
    (d.userRepo as Record<string, unknown>).updatePasswordHash = async (_u: string, hash: string) => { saved.push(hash); return 1; };
    const revoked: string[][] = [];
    (d.revocation as Record<string, unknown>).revokeAllForUserBefore = async (uid: string) => { revoked.push([uid]); };
    const uc = new ChangePasswordUseCase(d.userRepo as never, d.resetRepo as never, d.hasher as never, d.tokenPort as never, d.revocation as never, d.audit as never, d.tx as never);
    const out = await uc.execute({ userId: 'u1', currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD });
    expect(out.reauthRequired).toBe(true);
    expect(saved[0]).toMatch(/^hashed:/);
    expect(revoked.length).toBe(1);
    expect(auditCallsJson(d)).not.toContain(CURRENT_PASSWORD);
    expect(auditCallsJson(d)).not.toContain(NEW_PASSWORD);
  });

  it('updatePasswordHash trả rowCount 0 → 401 (user biến mất giữa chừng), không audit SUCCESS', async () => {
    const d = makeDeps();
    (d.userRepo as Record<string, unknown>).updatePasswordHash = async () => 0;
    const uc = new ChangePasswordUseCase(d.userRepo as never, d.resetRepo as never, d.hasher as never, d.tokenPort as never, d.revocation as never, d.audit as never, d.tx as never);
    await expect(uc.execute({ userId: 'u1', currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD })).rejects.toThrow(UnauthorizedException);
    expect(auditCallsJson(d)).not.toContain('IAM_PASSWORD_CHANGED');
    expect(auditCallsJson(d)).not.toContain(NEW_PASSWORD);
  });
});

describe('IAM-SRS-007 RequestPasswordResetUseCase (anti-enumeration + timing)', () => {
  it('email tồn tại: generic message + token lưu SHA-256 hash, không resetUrl', async () => {
    const d = makeDeps();
    const created: Array<Record<string, unknown>> = [];
    (d.resetRepo as Record<string, unknown>).create = async (r: Record<string, unknown>) => { created.push(r); return { id: 't1' }; };
    const uc = new RequestPasswordResetUseCase(d.userRepo as never, d.resetRepo as never, d.audit as never, d.tx as never);
    const out = await uc.execute({ email: 'admin@example.com' });
    expect(out.message).toContain('Nếu email tồn tại');
    expect(Object.keys(out)).not.toContain('resetUrl');
    expect(created[0]['tokenHash']).not.toContain('token'); // hash, not raw
    expect(String(created[0]['tokenHash'])).toMatch(/^[0-9a-f]{64}$/);
    // Housekeeping dọn token hết hạn chạy best-effort trên request path
    expect(d.resetRepo.deleteExpired).toHaveBeenCalled();
  });

  it('email không tồn tại: CÙNG message generic, không tạo token, có dummy write transaction', async () => {
    const d = makeDeps({ userRepo: { findByEmail: async () => null } });
    let createdCount = 0;
    (d.resetRepo as Record<string, unknown>).create = async () => { createdCount += 1; return { id: 't' }; };
    const uc = new RequestPasswordResetUseCase(d.userRepo as never, d.resetRepo as never, d.audit as never, d.tx as never);
    const out = await uc.execute({ email: 'ghost@example.com' });
    expect(out.message).toContain('Nếu email tồn tại');
    expect(Object.keys(out)).not.toContain('resetUrl');
    expect(createdCount).toBe(0);
    // Timing balancing: nhánh lạ vẫn tốn 1 write transaction (BEGIN..ROLLBACK)
    expect(d.tx.withTransaction).toHaveBeenCalledTimes(1);
  });

  it('email tồn tại vs không tồn tại → response GIỐNG HỆT nhau', async () => {
    const known = makeDeps();
    const unknown = makeDeps({ userRepo: { findByEmail: async () => null } });
    const ucKnown = new RequestPasswordResetUseCase(known.userRepo as never, known.resetRepo as never, known.audit as never, known.tx as never);
    const ucUnknown = new RequestPasswordResetUseCase(unknown.userRepo as never, unknown.resetRepo as never, unknown.audit as never, unknown.tx as never);
    const outKnown = await ucKnown.execute({ email: 'admin@example.com' });
    const outUnknown = await ucUnknown.execute({ email: 'ghost@example.com' });
    expect(outKnown).toEqual(outUnknown);
  });

  it('email tồn tại nhưng INACTIVE: generic, không tạo token, dummy write dùng đúng user id', async () => {
    const d = makeDeps();
    d.userEntity.isActive = () => false;
    let createdCount = 0;
    (d.resetRepo as Record<string, unknown>).create = async () => { createdCount += 1; return { id: 't' }; };
    const inserts: unknown[][] = [];
    d.tx.withTransaction.mockImplementation(async (fn: (c: { query: (q: string, v: unknown[]) => Promise<{ rowCount: number }> }) => Promise<unknown>) =>
      fn({ query: async (_q: string, v: unknown[]) => { inserts.push(v); return { rowCount: 1 }; } }));
    const uc = new RequestPasswordResetUseCase(d.userRepo as never, d.resetRepo as never, d.audit as never, d.tx as never);
    const out = await uc.execute({ email: 'admin@example.com' });
    expect(out.message).toContain('Nếu email tồn tại');
    expect(createdCount).toBe(0);
    expect(inserts[0]?.[0]).toBe('u1');
  });

  it('dummy write luôn ROLLBACK (sentinel throw bên trong tx) và không làm lỗi request', async () => {
    const d = makeDeps({ userRepo: { findByEmail: async () => null } });
    // Giả lập PgTransactionManager: fn throw → ROLLBACK → rethrow cho caller
    d.tx.withTransaction.mockImplementation(async (fn: (c: { query: () => Promise<{ rowCount: number }> }) => Promise<unknown>) => {
      try {
        return await fn({ query: async () => ({ rowCount: 1 }) });
      } catch (e) {
        throw e; // manager đã ROLLBACK rồi mới rethrow
      }
    });
    const uc = new RequestPasswordResetUseCase(d.userRepo as never, d.resetRepo as never, d.audit as never, d.tx as never);
    await expect(uc.execute({ email: 'ghost@example.com' })).resolves.toHaveProperty('message');
    expect(d.tx.withTransaction).toHaveBeenCalledTimes(1);
  });

  it('không bao giờ log token/hash vào audit (chỉ expiresAt)', async () => {
    const d = makeDeps();
    const uc = new RequestPasswordResetUseCase(d.userRepo as never, d.resetRepo as never, d.audit as never, d.tx as never);
    await uc.execute({ email: 'admin@example.com', ipAddress: '10.0.0.9', userAgent: 'jest' });
    const log = d.audit.log as unknown as jest.Mock;
    expect(Object.keys(log.mock.calls[0][0].afterData)).toEqual(['expiresAt']);
    expect(auditCallsJson(d)).not.toContain('tokenHash');
  });
});

describe('IAM-SRS-007 ResetPasswordUseCase (one-time + audit FAILED)', () => {
  it('token không hợp lệ/hết hạn → 401 + audit FAILED reason invalid_or_expired', async () => {
    const d = makeDeps({ resetRepo: { findLatestUsableByHash: async () => null } });
    const uc = new ResetPasswordUseCase(d.userRepo as never, d.resetRepo as never, d.hasher as never, d.revocation as never, d.audit as never, d.tx as never);
    await expect(uc.execute({ token: 'nonexistent-token-value', newPassword: NEW_PASSWORD })).rejects.toThrow(UnauthorizedException);
    expect(d.audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'IAM_PASSWORD_RESET_FAILED', result: 'FAILED', afterData: { reason: 'invalid_or_expired' },
    }));
    // Audit KHÔNG chứa giá trị token
    expect(auditCallsJson(d)).not.toContain('nonexistent-token-value');
  });

  it('dùng token thành công thì claim used_at + invalidate tokens khác', async () => {
    const d = makeDeps();
    const txQueries: string[] = [];
    d.tx.withTransaction.mockImplementation(async (fn: (c: { query: (q: string) => Promise<{ rowCount: number }> }) => Promise<unknown>) =>
      fn({ query: async (q: string) => { txQueries.push(q); return { rowCount: 1 }; } }));
    const invalidated: string[] = [];
    (d.resetRepo as Record<string, unknown>).invalidateAllForUser = async (uid: string) => { invalidated.push(uid); return 1; };
    const uc = new ResetPasswordUseCase(d.userRepo as never, d.resetRepo as never, d.hasher as never, d.revocation as never, d.audit as never, d.tx as never);
    const out = await uc.execute({ token: RESET_TOKEN, newPassword: NEW_PASSWORD });
    expect(out.reauthRequired).toBe(true);
    expect(txQueries.join(' ')).toContain('used_at =');
    expect(invalidated).toEqual(['u1']);
    expect(auditCallsJson(d)).not.toContain(RESET_TOKEN);
    expect(auditCallsJson(d)).not.toContain(NEW_PASSWORD);
  });

  it('concurrency claim: lần 1 rowCount 1 thành công, lần 2 rowCount 0 → 401 và hash KHÔNG đổi lần 2', async () => {
    const d = makeDeps();
    let claimCount = 0;
    const hashCalls: string[] = [];
    (d.hasher as Record<string, unknown>).hash = async (p: string) => { hashCalls.push(p); return 'hashed:' + p; };
    d.tx.withTransaction.mockImplementation(async (fn: (c: { query: (q: string) => Promise<{ rowCount: number }> }) => Promise<unknown>) =>
      fn({
        query: async (q: string) => {
          if (q.includes('used_at = $2')) {
            claimCount += 1;
            return { rowCount: claimCount === 1 ? 1 : 0 };
          }
          return { rowCount: 1 };
        },
      }));
    const uc = new ResetPasswordUseCase(d.userRepo as never, d.resetRepo as never, d.hasher as never, d.revocation as never, d.audit as never, d.tx as never);
    await expect(uc.execute({ token: RESET_TOKEN, newPassword: NEW_PASSWORD })).resolves.toEqual({ reauthRequired: true });
    await expect(uc.execute({ token: RESET_TOKEN, newPassword: NEW_PASSWORD })).rejects.toThrow(UnauthorizedException);
    expect(claimCount).toBe(2);
    // hash chỉ được tính/áp dụng đúng 1 lần — request thua race không đổi password
    expect(hashCalls).toHaveLength(1);
    // request 2 sinh audit FAILED reason already_used
    expect(d.audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'IAM_PASSWORD_RESET_FAILED', result: 'FAILED', afterData: { reason: 'already_used' },
    }));
    expect(auditCallsJson(d)).not.toContain(RESET_TOKEN);
    expect(auditCallsJson(d)).not.toContain(NEW_PASSWORD);
  });

  it('updatePasswordHash trả rowCount 0 → 401 + audit FAILED reason user_missing', async () => {
    const d = makeDeps({ userRepo: { updatePasswordHash: async () => 0 } });
    const uc = new ResetPasswordUseCase(d.userRepo as never, d.resetRepo as never, d.hasher as never, d.revocation as never, d.audit as never, d.tx as never);
    await expect(uc.execute({ token: RESET_TOKEN, newPassword: NEW_PASSWORD })).rejects.toThrow(UnauthorizedException);
    expect(d.audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'IAM_PASSWORD_RESET_FAILED', afterData: { reason: 'user_missing' },
    }));
    expect(auditCallsJson(d)).not.toContain(NEW_PASSWORD);
  });
});
