import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { validatePasswordPolicy } from '../src/modules/iam/domain/service/password.policy';
import { ChangePasswordUseCase } from '../src/modules/iam/application/use-case/change-password.use-case';
import { RequestPasswordResetUseCase } from '../src/modules/iam/application/use-case/request-password-reset.use-case';
import { ResetPasswordUseCase } from '../src/modules/iam/application/use-case/reset-password.use-case';

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

function makeDeps(overrides: Record<string, unknown> = {}) {
  const userEntity = {
    id: 'u1',
    passwordHash: '$2a$10$abcdefghijabcdefghijabcdefghijabcdefghijabcdefghij12',
    isActive: () => true,
  };
  return {
    userRepo: { findById: async () => userEntity, findByEmail: async () => userEntity, updatePasswordHash: async () => undefined, getPasswordChangedAt: async () => null, ...(overrides.userRepo ?? {}) },
    resetRepo: { create: async (r: unknown) => ({ id: 't1', ...(r as object) }), findLatestUsableByHash: async () => ({ id: 't1', userId: 'u1', tokenHash: 'h', expiresAt: new Date(Date.now() + 60000), usedAt: null, createdAt: new Date() }), invalidateAllForUser: async () => 1, ...(overrides.resetRepo ?? {}) },
    hasher: { hash: async (p: string) => 'hashed:' + p, compare: async (p: string) => p === 'Current1', ...(overrides.hasher ?? {}) },
    tokenPort: {},
    revocation: { revokeAllForUserBefore: async () => undefined, isRevoked: async () => false, revoke: async () => undefined, isUserRevokedBefore: async () => false },
    audit: { log: async () => undefined, logWithClient: async () => undefined },
    tx: { withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn({ query: async () => ({ rowCount: 1 }) }) },
  };
}

describe('IAM-SRS-007 ChangePasswordUseCase', () => {
  it('từ chối current password sai, không đổi dữ liệu', async () => {
    const d = makeDeps();
    let saved = false;
    d.userRepo.updatePasswordHash = async () => { saved = true; };
    const uc = new ChangePasswordUseCase(d.userRepo as never, d.resetRepo as never, d.hasher as never, d.tokenPort as never, d.revocation as never, d.audit as never, d.tx as never);
    await expect(uc.execute({ userId: 'u1', currentPassword: 'Wrong1x', newPassword: 'NewPass99' })).rejects.toThrow(BadRequestException);
    expect(saved).toBe(false);
  });

  it('từ chối policy không đạt', async () => {
    const d = makeDeps();
    const uc = new ChangePasswordUseCase(d.userRepo as never, d.resetRepo as never, d.hasher as never, d.tokenPort as never, d.revocation as never, d.audit as never, d.tx as never);
    await expect(uc.execute({ userId: 'u1', currentPassword: 'Current1', newPassword: 'allletters' })).rejects.toThrow(BadRequestException);
  });

  it('đổi thành công, hash mới không plaintext, cutoff revoked', async () => {
    const d = makeDeps();
    const saved: string[] = [];
    (d.userRepo as Record<string, unknown>).updatePasswordHash = async (_u: string, hash: string) => { saved.push(hash); };
    const revoked: Array<[string]> = [];
    (d.revocation as Record<string, unknown>).revokeAllForUserBefore = async (uid: string) => { revoked.push([uid]); };
    const uc = new ChangePasswordUseCase(d.userRepo as never, d.resetRepo as never, d.hasher as never, d.tokenPort as never, d.revocation as never, d.audit as never, d.tx as never);
    const out = await uc.execute({ userId: 'u1', currentPassword: 'Current1', newPassword: 'NewPass99' });
    expect(out.reauthRequired).toBe(true);
    expect(saved[0]).toMatch(/^hashed:/);
    expect(revoked.length).toBe(1);
  });
});

describe('IAM-SRS-007 RequestPasswordResetUseCase (anti-enumeration)', () => {
  it('email tồn tại: generic message + token lưu hash', async () => {
    const d = makeDeps();
    const created: Array<Record<string, unknown>> = [];
    (d.resetRepo as Record<string, unknown>).create = async (r: Record<string, unknown>) => { created.push(r); return { id: 't1' }; };
    const uc = new RequestPasswordResetUseCase(d.userRepo as never, d.resetRepo as never, d.audit as never);
    process.env.JWT_SECRET = 'dev-jwt-secret-change-me';
    const out = await uc.execute({ email: 'admin@example.com' });
    expect(out.message).toContain('Nếu email tồn tại');
    expect(created[0]['tokenHash']).not.toContain('token'); // hash, not raw
  });

  it('email không tồn tại: cùng message, không tạo token', async () => {
    const d = makeDeps();
    (d.userRepo as Record<string, unknown>).findByEmail = async () => null;
    let createdCount = 0;
    (d.resetRepo as Record<string, unknown>).create = async () => { createdCount += 1; return { id: 't' }; };
    const uc = new RequestPasswordResetUseCase(d.userRepo as never, d.resetRepo as never, d.audit as never);
    const out = await uc.execute({ email: 'ghost@example.com' });
    expect(out.message).toContain('Nếu email tồn tại');
    expect(createdCount).toBe(0);
  });
});

describe('IAM-SRS-007 ResetPasswordUseCase (one-time)', () => {
  it('token không hợp lệ/hết hạn → 401', async () => {
    const d = makeDeps();
    (d.resetRepo as Record<string, unknown>).findLatestUsableByHash = async () => null;
    const uc = new ResetPasswordUseCase(d.userRepo as never, d.resetRepo as never, d.hasher as never, d.revocation as never, d.audit as never, d.tx as never);
    await expect(uc.execute({ token: 'nonexistent', newPassword: 'NewPass99' })).rejects.toThrow(UnauthorizedException);
  });

  it('dùng token thành công thì markUsed + invalidate tokens khác', async () => {
    const d = makeDeps();
    const txQueries: string[] = [];
    (d.tx as Record<string, unknown>).withTransaction = async (fn: (c: { query: (q: string, v?: unknown[]) => Promise<{ rowCount: number }> }) => Promise<unknown>) =>
      fn({ query: async (q: string) => { txQueries.push(q); return { rowCount: 1 }; } });
    const invalidated: string[] = [];
    (d.resetRepo as Record<string, unknown>).invalidateAllForUser = async (uid: string) => { invalidated.push(uid); return 1; };
    const uc = new ResetPasswordUseCase(d.userRepo as never, d.resetRepo as never, d.hasher as never, d.revocation as never, d.audit as never, d.tx as never);
    const out = await uc.execute({ token: 'validtoken123', newPassword: 'NewPass99' });
    expect(out.reauthRequired).toBe(true);
    expect(txQueries.join(' ')).toContain('used_at =');
    expect(invalidated).toEqual(['u1']);
  });
});
