import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CheckWorkOrderPublishUseCase } from './check-work-order-publish.use-case';
import { PublishCheckSnapshot } from '../../domain/service/work-order-publish-check.policy';
import { WorkOrderPublishCheckReadPort } from '../../domain/repository/work-order-publish-check.read-port';

const IDS = {
  wo: '11111111-1111-4111-8111-111111111111',
  missing: '00000000-0000-4000-8000-000000000000',
  project: '22222222-2222-4222-8222-222222222222',
  workType: '44444444-4444-4444-8444-444444444444',
  admin: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  member: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  outsider: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
};

function makeSnapshot(): PublishCheckSnapshot {
  return {
    workOrder: {
      id: IDS.wo,
      projectId: IDS.project,
      areaId: null,
      requiredTradeId: null,
      title: 'Đổ bê tông cột C1',
      code: 'WO-2026-A1',
      description: 'Mô tả',
      instructions: null,
      priority: 'NORMAL',
      status: 'DRAFT',
      plannedStartAt: null,
      plannedEndAt: null,
      plannedHeadcount: null,
      jobBoardOpen: false,
    },
    project: { id: IDS.project, status: 'ACTIVE' },
    workType: { id: IDS.workType, isActive: true, requiredTradeId: null, requiredFieldsRaw: [] },
    area: null,
    workTypeTrade: null,
    workOrderTrade: null,
  };
}

function setup(memberIds: string[] = [IDS.member]) {
  const read = {
    fetchSnapshot: jest.fn(async (id: string) => (id === IDS.wo ? makeSnapshot() : null)),
  } as unknown as WorkOrderPublishCheckReadPort & { fetchSnapshot: jest.Mock };
  const scope = {
    assertProjectMemberScope: jest.fn(
      async ({ userId, actorRoles }: { userId: string; actorRoles: string[] }) => {
        if ((actorRoles ?? []).includes('ADMIN')) return { isAdminBypass: true };
        if (memberIds.includes(userId)) return { isAdminBypass: false };
        throw new ForbiddenException('Không có quyền truy cập dự án này');
      },
    ),
  };
  const uc = new CheckWorkOrderPublishUseCase(read, scope as never);
  return { uc, read, scope };
}

describe('CheckWorkOrderPublishUseCase (JOB-SRS-002)', () => {
  it('member đọc được + composition: DRAFT thiếu schedule → ready false, unmet cụ thể', async () => {
    const { uc, scope } = setup();
    const out = await uc.execute({ workOrderId: IDS.wo, actorUserId: IDS.member, actorRoles: ['WORKER'] });
    expect(out.workOrderId).toBe(IDS.wo);
    expect(out.status).toBe('DRAFT');
    expect(out.ready).toBe(false);
    expect(out.unmet.map((u) => u.code)).toEqual(['MISSING_SCHEDULE', 'MISSING_SCHEDULE']);
    expect(out.checkedAt).toBeInstanceOf(Date);
    expect(scope.assertProjectMemberScope).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: IDS.project }),
    );
  });

  it('non-member: snapshot tồn tại hay không đều 403 (không phân biệt, không leak)', async () => {
    const { uc } = setup([]);
    await expect(
      uc.execute({ workOrderId: IDS.wo, actorUserId: IDS.outsider, actorRoles: ['WORKER'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      uc.execute({ workOrderId: IDS.missing, actorUserId: IDS.outsider, actorRoles: ['WORKER'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('ADMIN: tồn tại → bypass; missing → 404', async () => {
    const { uc, scope } = setup([]);
    const out = await uc.execute({ workOrderId: IDS.wo, actorUserId: IDS.admin, actorRoles: ['ADMIN'] });
    expect(out.workOrderId).toBe(IDS.wo);
    expect(scope.assertProjectMemberScope).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: IDS.project }),
    );
    await expect(
      uc.execute({ workOrderId: IDS.missing, actorUserId: IDS.admin, actorRoles: ['ADMIN'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('actor không member (anon đã bị guard chặn 401 ở controller) → scope 403', async () => {
    const { uc } = setup();
    // Use case không tự validate auth (JwtAuthGuard + controller lo 401);
    // actor lạ không membership → scope 403.
    await expect(
      uc.execute({ workOrderId: IDS.wo, actorUserId: '', actorRoles: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
