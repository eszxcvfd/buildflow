import { AuditLogEntity } from './audit-log.entity';

describe('AuditLogEntity IAM-SRS-008 sanitization', () => {
  it('isSanitized true cho data sạch', () => {
    expect(AuditLogEntity.isSanitized({ email: 'a@b.com', reason: 'invalid_password' })).toBe(true);
    expect(AuditLogEntity.isSanitized({ roleIds: ['r1'], beforeData: { status: 'ACTIVE' } })).toBe(true);
    expect(AuditLogEntity.isSanitized(null)).toBe(true);
  });

  it('isSanitized false khi chứa password', () => {
    expect(AuditLogEntity.isSanitized({ password: 'secret123' })).toBe(false);
    expect(AuditLogEntity.isSanitized({ passwordHash: '$2b$10$...' })).toBe(false);
    expect(AuditLogEntity.isSanitized({ data: { password: 'x' } })).toBe(false);
  });

  it('isSanitized false khi chứa token/secret/resetCode', () => {
    expect(AuditLogEntity.isSanitized({ token: 'jwt-123' })).toBe(false);
    expect(AuditLogEntity.isSanitized({ secret: 'shhh' })).toBe(false);
    expect(AuditLogEntity.isSanitized({ resetCode: '123456' })).toBe(false);
    expect(AuditLogEntity.isSanitized({ jti: 'ok', token: 'bad' })).toBe(false);
  });

  it('IAM-SRS-008: chặn thêm biến thể secret key (passwd/pwd/password_hash/reset_code/jwt/refresh_token)', () => {
    expect(AuditLogEntity.isSanitized({ passwd: 'x' })).toBe(false);
    expect(AuditLogEntity.isSanitized({ pwd: 'x' })).toBe(false);
    expect(AuditLogEntity.isSanitized({ password_hash: '$2b$10$...' })).toBe(false);
    expect(AuditLogEntity.isSanitized({ reset_code: '123456' })).toBe(false);
    expect(AuditLogEntity.isSanitized({ jwt: 'eyJhbGciOi...' })).toBe(false);
    expect(AuditLogEntity.isSanitized({ refresh_token: 'r-123' })).toBe(false);
    expect(AuditLogEntity.isSanitized({ access_token: 'a-123' })).toBe(false);
  });

  it('IAM-SRS-008: chặn secret lồng trong before/after data (mọi độ sâu key)', () => {
    expect(AuditLogEntity.isSanitized({ data: { token: 'nested-token' } })).toBe(false);
    expect(AuditLogEntity.isSanitized({ before: { password: 'nested-pass' } })).toBe(false);
    expect(AuditLogEntity.isSanitized({ profile: { resetCode: '654321' } })).toBe(false);
    expect(AuditLogEntity.isSanitized({ meta: { password_hash: '$2b$10$...' } })).toBe(false);
    expect(AuditLogEntity.isSanitized({ session: { refresh_token: 'r-123' } })).toBe(false);
    expect(AuditLogEntity.isSanitized({ list: [{ secret: 'deep-in-array' }] })).toBe(false);
  });

  it('IAM-SRS-008: giá trị text thông thường không bị false positive', () => {
    expect(AuditLogEntity.isSanitized({ email: 'a@b.com', reason: 'invalid_password' })).toBe(true);
    expect(AuditLogEntity.isSanitized({ note: 'user hash fingerprint changed' })).toBe(true);
    expect(AuditLogEntity.isSanitized({ roles: ['ADMIN'], status: 'ACTIVE' })).toBe(true);
  });

  it('entity getters trả đúng props', () => {
    const e = new AuditLogEntity({
      id: 'id-1',
      actorUserId: 'user-1',
      action: 'AUTH_LOGIN_SUCCESS',
      entityType: 'USER',
      entityId: 'user-1',
      beforeData: null,
      afterData: { email: 'a@b.com' },
      reason: 'Sai mật khẩu',
      result: 'SUCCESS',
      ipAddress: '1.2.3.4',
      userAgent: 'jest',
      correlationId: 'corr-1',
      createdAt: new Date('2026-08-27T00:00:00.000Z'),
    });
    expect(e.id).toBe('id-1');
    expect(e.action).toBe('AUTH_LOGIN_SUCCESS');
    expect(e.reason).toBe('Sai mật khẩu');
    expect(e.result).toBe('SUCCESS');
    expect(e.createdAt.toISOString()).toBe('2026-08-27T00:00:00.000Z');
  });
});
