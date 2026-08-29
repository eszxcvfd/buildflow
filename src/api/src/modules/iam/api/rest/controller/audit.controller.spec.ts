import { ForbiddenException } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { QueryAuditLogsUseCase } from '../../../application/use-case/query-audit-logs.use-case';
import { AuditLogEntity } from '../../../domain/entity/audit-log.entity';

function makeLog(id: string): AuditLogEntity {
  return new AuditLogEntity({
    id,
    actorUserId: 'admin-1',
    action: 'AUTH_LOGIN_SUCCESS',
    entityType: 'USER',
    entityId: 'user-1',
    beforeData: null,
    afterData: { email: 'a@b.com' },
    result: 'SUCCESS',
    ipAddress: '1.2.3.4',
    userAgent: 'jest',
    correlationId: `corr-${id}`,
    createdAt: new Date('2026-08-27T00:00:00.000Z'),
  });
}

describe('AuditController IAM-SRS-008', () => {
  let query: jest.Mocked<QueryAuditLogsUseCase>;
  let controller: AuditController;

  beforeEach(() => {
    query = { execute: jest.fn() } as unknown as jest.Mocked<QueryAuditLogsUseCase>;
    controller = new AuditController(query);
  });

  function mockReq(roles: string[] = ['ADMIN']): unknown {
    return { user: { sub: 'admin-1', roles }, headers: {}, ip: '127.0.0.1' };
  }

  it('GET /api/v1/audit-logs — ADMIN success với filter và pagination', async () => {
    query.execute.mockResolvedValue({ entities: [makeLog('1')], total: 1 });
    const req = mockReq(['ADMIN']);
    const res = await controller.list(req as never, 'AUTH_LOGIN_SUCCESS', undefined, undefined, undefined, 'SUCCESS', undefined, undefined, undefined, '20', '0');
    expect(query.execute).toHaveBeenCalledWith(expect.objectContaining({
      actorRoles: ['ADMIN'],
      filter: expect.objectContaining({ action: 'AUTH_LOGIN_SUCCESS', result: 'SUCCESS', limit: 20, offset: 0 }),
    }));
    expect(res.data).toHaveLength(1);
    expect(res.total).toBe(1);
  });

  it('unauthorized user không query được audit — 403', async () => {
    query.execute.mockRejectedValue(new ForbiddenException('Không có quyền truy cập'));
    const req = mockReq(['WORKER']);
    await expect(controller.list(req as never, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined)).rejects.toThrow(ForbiddenException);
  });

  it('validation limit/offset ở controller', async () => {
    const req = mockReq(['ADMIN']);
    await expect(controller.list(req as never, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, '0', '0')).rejects.toThrow('Limit không hợp lệ');
    await expect(controller.list(req as never, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, '20', '-1')).rejects.toThrow('Offset không hợp lệ');
  });

  it('không leak secret ở response — afterData không chứa password', async () => {
    const clean = makeLog('1');
    query.execute.mockResolvedValue({ entities: [clean], total: 1 });
    const req = mockReq(['ADMIN']);
    const res = await controller.list(req as never, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
    const payload = JSON.stringify(res.data);
    expect(payload.toLowerCase()).not.toContain('"password"');
    expect(payload.toLowerCase()).not.toContain('"token"');
  });

  it('sửa ID/URL không bypass — cần ADMIN role', async () => {
    // Controller relies on server-derived roles, not client query to authorize
    query.execute.mockRejectedValue(new ForbiddenException('Không có quyền truy cập'));
    const req = mockReq(['WORKER']);
    await expect(controller.list(req as never, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined)).rejects.toThrow(ForbiddenException);
    expect(query.execute).toHaveBeenCalledWith(expect.objectContaining({ actorRoles: ['WORKER'] }));
  });
});
