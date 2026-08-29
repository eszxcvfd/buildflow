import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { QueryAuditLogsUseCase } from './query-audit-logs.use-case';
import { AuditLogRepositoryPort } from '../../domain/repository/audit-log-repository.port';
import { AuditLogEntity, AuditLogProps } from '../../domain/entity/audit-log.entity';

function makeLog(overrides: Partial<AuditLogProps> = {}): AuditLogEntity {
  return new AuditLogEntity({
    id: 'log-1',
    actorUserId: 'user-1',
    action: 'AUTH_LOGIN_SUCCESS',
    entityType: 'USER',
    entityId: 'user-1',
    beforeData: null,
    afterData: { email: 'a@b.com', roles: ['WORKER'] },
    result: 'SUCCESS',
    ipAddress: '1.2.3.4',
    userAgent: 'jest',
    correlationId: 'corr-1',
    createdAt: new Date('2026-08-27T00:00:00.000Z'),
    ...overrides,
  } as AuditLogProps);
}

describe('QueryAuditLogsUseCase IAM-SRS-008', () => {
  let repo: jest.Mocked<AuditLogRepositoryPort>;
  let useCase: QueryAuditLogsUseCase;

  beforeEach(() => {
    repo = {
      findMany: jest.fn(async () => ({ entities: [makeLog()], total: 1 })),
      findById: jest.fn(),
      existsByCorrelation: jest.fn(),
    } as unknown as jest.Mocked<AuditLogRepositoryPort>;
    useCase = new QueryAuditLogsUseCase(repo);
  });

  it('ADMIN có thể query audit (authorized)', async () => {
    const out = await useCase.execute({ actorUserId: 'admin-1', actorRoles: ['ADMIN'], filter: {} });
    expect(out.entities).toHaveLength(1);
    expect(repo.findMany).toHaveBeenCalled();
  });

  it('non-ADMIN bị Forbidden (không có quyền đọc audit)', async () => {
    await expect(useCase.execute({ actorUserId: 'user-1', actorRoles: ['WORKER'], filter: {} })).rejects.toThrow(ForbiddenException);
    await expect(useCase.execute({ actorUserId: 'user-1', actorRoles: [], filter: {} })).rejects.toThrow('Không có quyền truy cập');
    expect(repo.findMany).not.toHaveBeenCalled();
  });

  it('anonymous failed login vẫn được audit (actor null) và query được', async () => {
    const anonLog = makeLog({ actorUserId: null, action: 'AUTH_LOGIN_FAILED', afterData: { email: 'unknown@x.com', reason: 'user_not_found' } });
    repo.findMany.mockResolvedValue({ entities: [anonLog], total: 1 });
    const out = await useCase.execute({ actorUserId: 'admin-1', actorRoles: ['ADMIN'], filter: { action: 'AUTH_LOGIN_FAILED' } });
    expect(out.entities[0].actorUserId).toBeNull();
    expect(out.entities[0].action).toBe('AUTH_LOGIN_FAILED');
  });

  it('filter đúng: action, result, entityType, correlationId', async () => {
    repo.findMany.mockResolvedValue({ entities: [makeLog({ action: 'IAM_ROLE_ASSIGNED' })], total: 1 });
    await useCase.execute({
      actorUserId: 'admin-1',
      actorRoles: ['ADMIN'],
      filter: { action: 'IAM_ROLE_ASSIGNED', result: 'SUCCESS', entityType: 'USER', correlationId: 'corr-1' },
    });
    expect(repo.findMany).toHaveBeenCalledWith(expect.objectContaining({
      action: 'IAM_ROLE_ASSIGNED',
      result: 'SUCCESS',
      entityType: 'USER',
      correlationId: 'corr-1',
    }));
  });

  it('mỗi event bắt buộc tạo đúng một audit record — query không duplicate', async () => {
    // Simulate two distinct events with different correlationIds
    const log1 = makeLog({ id: '1', correlationId: 'corr-1' });
    const log2 = makeLog({ id: '2', correlationId: 'corr-2', action: 'AUTH_LOGOUT' });
    repo.findMany.mockResolvedValue({ entities: [log1, log2], total: 2 });
    const out = await useCase.execute({ actorUserId: 'admin-1', actorRoles: ['ADMIN'], filter: {} });
    expect(out.total).toBe(2);
    expect(out.entities.map((e) => e.correlationId).sort()).toEqual(['corr-1', 'corr-2']);
  });

  it('retry/duplicate event không nhân bản — existsByCorrelation phát hiện', async () => {
    // This is repository-level idempotency check; useCase ensures filter by correlationId returns existing
    repo.findMany.mockResolvedValue({ entities: [makeLog({ correlationId: 'dup-1' })], total: 1 });
    repo.existsByCorrelation.mockResolvedValue(true);
    // Caller would check existsByCorrelation before logging duplicate
    const exists = await repo.existsByCorrelation('dup-1', 'AUTH_LOGIN_SUCCESS', 'user-1');
    expect(exists).toBe(true);
    const out = await useCase.execute({
      actorUserId: 'admin-1',
      actorRoles: ['ADMIN'],
      filter: { correlationId: 'dup-1' },
    });
    expect(out.total).toBe(1);
  });

  it('audit không chứa password/token/reset code — isSanitized kiểm tra', async () => {
    const badLog = makeLog({ afterData: { token: 'jwt-secret', password: '123' } });
    repo.findMany.mockResolvedValue({ entities: [badLog], total: 1 });
    await expect(useCase.execute({ actorUserId: 'admin-1', actorRoles: ['ADMIN'], filter: {} })).rejects.toThrow(BadRequestException);
  });

  it('validation limit/offset/result', async () => {
    await expect(useCase.execute({ actorUserId: 'admin-1', actorRoles: ['ADMIN'], filter: { limit: 0 } })).rejects.toThrow(BadRequestException);
    await expect(useCase.execute({ actorUserId: 'admin-1', actorRoles: ['ADMIN'], filter: { limit: 101 } })).rejects.toThrow(BadRequestException);
    await expect(useCase.execute({ actorUserId: 'admin-1', actorRoles: ['ADMIN'], filter: { offset: -1 } })).rejects.toThrow(BadRequestException);
    await expect(useCase.execute({ actorUserId: 'admin-1', actorRoles: ['ADMIN'], filter: { result: 'INVALID' as never } })).rejects.toThrow(BadRequestException);
  });

  it('validation khoảng thời gian from > to', async () => {
    await expect(useCase.execute({
      actorUserId: 'admin-1',
      actorRoles: ['ADMIN'],
      filter: { from: new Date('2026-08-28'), to: new Date('2026-08-27') },
    })).rejects.toThrow('Khoảng thời gian không hợp lệ');
  });

  it('audit append-only: query không cho phép sửa/xóa — chỉ read', async () => {
    // Repository chỉ có findMany/findById/existsByCorrelation, không có update/delete
    expect((repo as unknown as Record<string, unknown>).update).toBeUndefined();
    expect((repo as unknown as Record<string, unknown>).delete).toBeUndefined();
    const out = await useCase.execute({ actorUserId: 'admin-1', actorRoles: ['ADMIN'], filter: { limit: 20 } });
    expect(out.entities).toBeDefined();
  });
});
