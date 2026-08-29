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

  it('entity getters trả đúng props', () => {
    const e = new AuditLogEntity({
      id: 'id-1',
      actorUserId: 'user-1',
      action: 'AUTH_LOGIN_SUCCESS',
      entityType: 'USER',
      entityId: 'user-1',
      beforeData: null,
      afterData: { email: 'a@b.com' },
      result: 'SUCCESS',
      ipAddress: '1.2.3.4',
      userAgent: 'jest',
      correlationId: 'corr-1',
      createdAt: new Date('2026-08-27T00:00:00.000Z'),
    });
    expect(e.id).toBe('id-1');
    expect(e.action).toBe('AUTH_LOGIN_SUCCESS');
    expect(e.result).toBe('SUCCESS');
    expect(e.createdAt.toISOString()).toBe('2026-08-27T00:00:00.000Z');
  });
});
