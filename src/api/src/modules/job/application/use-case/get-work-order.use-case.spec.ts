import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GetWorkOrderUseCase } from './get-work-order.use-case';
import { WorkOrderEntity } from '../../domain/entity/work-order.entity';
import { WorkOrderRepositoryPort } from '../../domain/repository/work-order-repository.port';

const IDS = {
  wo: '11111111-1111-4111-8111-111111111111',
  missing: '00000000-0000-4000-8000-000000000000',
  project: '22222222-2222-4222-8222-222222222222',
  workType: '44444444-4444-4444-8444-444444444444',
  admin: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  member: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  outsider: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
};

function makeEntity(): WorkOrderEntity {
  return new WorkOrderEntity({
    id: IDS.wo,
    code: 'WO-2026-A1',
    projectId: IDS.project,
    areaId: null,
    workTypeId: IDS.workType,
    requiredTradeId: null,
    title: 'Đổ bê tông cột C1',
    description: null,
    instructions: null,
    priority: 'NORMAL',
    status: 'DRAFT',
    plannedStartAt: null,
    plannedEndAt: null,
    dueAt: null,
    plannedHeadcount: null,
    customFields: {},
    createdBy: IDS.admin,
    version: 1,
    requestKey: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function setup(memberIds: string[] = [IDS.member]) {
  const repo = {
    findById: jest.fn(async (id: string) => (id === IDS.wo ? makeEntity() : null)),
    findWorkTypeNameById: jest.fn(async () => 'Đổ bê tông'),
  } as unknown as WorkOrderRepositoryPort & { findById: jest.Mock };
  const scope = {
    assertProjectMemberScope: jest.fn(async ({ userId, actorRoles }: { userId: string; actorRoles: string[] }) => {
      if ((actorRoles ?? []).includes('ADMIN')) return { isAdminBypass: true };
      if (memberIds.includes(userId)) return { isAdminBypass: false };
      throw new ForbiddenException('Không có quyền truy cập dự án này');
    }),
  };
  const uc = new GetWorkOrderUseCase(repo, scope as never);
  return { uc, repo, scope };
}

describe('GetWorkOrderUseCase (JOB-SRS-001)', () => {
  it('member của project (kể cả WORKER) đọc được nháp', async () => {
    const { uc } = setup();
    const { entity, workTypeName } = await uc.execute({
      workOrderId: IDS.wo,
      actorUserId: IDS.member,
      actorRoles: ['WORKER'],
    });
    expect(entity.id).toBe(IDS.wo);
    expect(workTypeName).toBe('Đổ bê tông');
  });

  it('non-member: id tồn tại hay không đều 403 (không phân biệt)', async () => {
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
    expect(out.entity.id).toBe(IDS.wo);
    expect(scope.assertProjectMemberScope).toHaveBeenCalledWith(expect.objectContaining({ projectId: IDS.project }));
    await expect(
      uc.execute({ workOrderId: IDS.missing, actorUserId: IDS.admin, actorRoles: ['ADMIN'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('G1: WO ASSIGNED (non-DRAFT) đọc được — rehydrate không ép DRAFT', async () => {
    const assigned = WorkOrderEntity.fromPersistence({ ...makeEntity().getProps(), status: 'ASSIGNED' });
    const repo = {
      findById: jest.fn(async () => assigned),
      findWorkTypeNameById: jest.fn(async () => 'Đổ bê tông'),
    } as unknown as WorkOrderRepositoryPort & { findById: jest.Mock };
    const scope = {
      assertProjectMemberScope: jest.fn(async () => ({ isAdminBypass: false })),
    };
    const uc = new GetWorkOrderUseCase(repo, scope as never);
    const out = await uc.execute({ workOrderId: IDS.wo, actorUserId: IDS.member, actorRoles: ['WORKER'] });
    expect(out.entity.status).toBe('ASSIGNED');
    expect(out.entity.isDraft()).toBe(false);
  });
});
