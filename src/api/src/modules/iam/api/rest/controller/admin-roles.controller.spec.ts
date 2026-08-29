import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { AdminRolesController } from './admin-roles.controller';
import { GetUserRolesUseCase } from '../../../application/use-case/get-user-roles.use-case';
import { AssignRolesUseCase } from '../../../application/use-case/assign-roles.use-case';

function adminReq(roles: string[] = ['ADMIN'], sub = 'admin-1'): unknown {
  return {
    user: { sub, email: 'admin@example.com', roles },
    headers: { 'user-agent': 'jest', 'x-correlation-id': 'corr-xyz' },
    ip: '127.0.0.1',
  } as unknown as never;
}
function workerReq(): unknown {
  return { user: { sub: 'u2', email: 'w@example.com', roles: ['WORKER'] }, headers: {}, ip: '127.0.0.1' } as unknown as never;
}

describe('AdminRolesController IAM-SRS-005', () => {
  let getMock: jest.Mocked<GetUserRolesUseCase>;
  let assignMock: jest.Mocked<AssignRolesUseCase>;
  let ctrl: AdminRolesController;

  beforeEach(() => {
    getMock = { execute: jest.fn(async () => ({ targetUserId: 'user-1', roles: [{ id: 'r1', code: 'WORKER', name: 'Worker' }], effectivePolicy: 'NEXT_LOGIN' })) } as unknown as jest.Mocked<GetUserRolesUseCase>;
    assignMock = {
      execute: jest.fn(async () => ({
        targetUserId: 'user-1',
        beforeRoleIds: ['r0'],
        afterRoleIds: ['r1'],
        roles: [{ id: 'r1', code: 'WORKER', name: 'Worker' }],
        effectivePolicy: 'NEXT_LOGIN',
      })),
    } as unknown as jest.Mocked<AssignRolesUseCase>;
    ctrl = new AdminRolesController(getMock, assignMock);
  });

  it('GET roles forbids non-ADMIN', async () => {
    await expect(ctrl.getRoles('11111111-1111-4111-8111-111111111111', workerReq() as never)).rejects.toThrow(ForbiddenException);
  });

  it('PUT roles forbids non-ADMIN', async () => {
    await expect(
      ctrl.assign('11111111-1111-4111-8111-111111111111', { roleIds: ['22222222-2222-4222-8222-222222222222'] } as never, workerReq() as never),
    ).rejects.toThrow(ForbiddenException);
  });

  it('GET delegates to use-case with server-derived actorRoles', async () => {
    const res = await ctrl.getRoles('11111111-1111-4111-8111-111111111111', adminReq() as never);
    expect(getMock.execute).toHaveBeenCalledWith(expect.objectContaining({ actorRoles: ['ADMIN'], actorUserId: 'admin-1' }));
    expect(res.roles).toHaveLength(1);
  });

  it('PUT delegates with correlationId and metadata', async () => {
    const dto: { roleIds: string[]; reason: string } = { roleIds: ['22222222-2222-4222-8222-222222222222'], reason: 'promote' };
    const res = await ctrl.assign('11111111-1111-4111-8111-111111111111', dto as never, adminReq() as never);
    expect(assignMock.execute).toHaveBeenCalledWith(
      expect.objectContaining({ roleIds: dto.roleIds, correlationId: 'corr-xyz', reason: 'promote' }),
    );
    expect(res.beforeRoleIds).toEqual(['r0']);
    expect(res.afterRoleIds).toEqual(['r1']);
  });

  it('PUT validation pipe should reject invalid UUID — controller still calls use-case which throws', async () => {
    // Simulate use-case throwing due to invalid UUID (validation also happens in use-case)
    (assignMock.execute as jest.Mock) = jest.fn(async () => {
      throw new BadRequestException('Role ID không hợp lệ');
    });
    const badCtrl = new AdminRolesController(getMock, assignMock);
    await expect(
      badCtrl.assign('11111111-1111-4111-8111-111111111111', { roleIds: ['not-uuid'] } as never, adminReq() as never),
    ).rejects.toThrow(BadRequestException);
  });
});
