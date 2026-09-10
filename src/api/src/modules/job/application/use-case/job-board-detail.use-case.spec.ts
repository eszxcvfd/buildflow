import { ConflictException, ForbiddenException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { GetJobBoardDetailUseCase } from './job-board-detail.use-case';
import { WorkOrderEntity } from '../../domain/entity/work-order.entity';
import { ChecklistTemplateRow, WorkOrderRepositoryPort, WorkTypeDetailRef } from '../../domain/repository/work-order-repository.port';

const IDS = {
  wo: '11111111-1111-4111-8111-111111111111',
  missing: '00000000-0000-4000-8000-000000000000',
  project: '22222222-2222-4222-8222-222222222222',
  area: '55555555-5555-4555-8555-555555555555',
  workType: '44444444-4444-4444-8444-444444444444',
  trade: '66666666-6666-4666-8666-666666666666',
  admin: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  member: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  outsider: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  clPerType: '77777777-7777-4777-8777-777777777777',
  clGeneric: '88888888-8888-4888-8888-888888888888',
};

function makeEntity(over: Partial<Record<string, unknown>> = {}): WorkOrderEntity {
  return new WorkOrderEntity({
    id: IDS.wo,
    code: 'WO-2026-A1',
    projectId: IDS.project,
    areaId: IDS.area,
    workTypeId: IDS.workType,
    requiredTradeId: IDS.trade,
    title: 'Do be tong cot C1',
    description: 'Mo ta',
    instructions: 'Huong dan',
    priority: 'NORMAL',
    status: 'OPEN',
    plannedStartAt: new Date('2026-11-05T08:00:00.000Z'),
    plannedEndAt: new Date('2026-11-06T08:00:00.000Z'),
    dueAt: null,
    plannedHeadcount: 5,
    customFields: { dien_tich: 12 },
    createdBy: IDS.admin,
    version: 2,
    requestKey: null,
    jobBoardOpen: true,
    jobBoardOpenFrom: new Date('2026-10-01T08:00:00.000Z'),
    jobBoardOpenUntil: new Date('2026-12-01T08:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...(over as Record<string, never>),
  });
}

function workTypeDetail(): WorkTypeDetailRef {
  return {
    id: IDS.workType,
    name: 'Do be tong',
    description: 'Mo ta loai',
    requiredFields: [{ key: 'dien_tich', label: 'Dien tich', type: 'number' }],
    workTypeGroup: 'Ket cau',
    configVersion: 3,
  };
}

function templates(): ChecklistTemplateRow[] {
  return [
    { id: IDS.clPerType, code: 'CL-PRE', name: 'Kiem tra truoc', workTypeId: IDS.workType, purpose: 'PRE_START', version: 2, description: null, status: 'ACTIVE' },
    { id: IDS.clGeneric, code: 'CL-GEN', name: 'An toan chung', workTypeId: null, purpose: 'INSPECTION', version: 1, description: 'Mo ta chung', status: 'ACTIVE' },
  ];
}

function setup(opts: {
  memberIds?: string[];
  entity?: WorkOrderEntity | null;
  detail?: WorkTypeDetailRef | null;
  rows?: ChecklistTemplateRow[];
  items?: { templateId: string; sequenceNo: number }[];
  assigned?: boolean;
  stripMethod?: 'findWorkTypeDetailById' | 'findActiveChecklistTemplatesByWorkTypeId' | 'findChecklistItemsByTemplateIds' | 'hasActiveAssignmentByWorkOrderIds';
} = {}) {
  const entity = opts.entity !== undefined ? opts.entity : makeEntity();
  const repo = {
    findById: jest.fn(async (id: string) => (id === IDS.wo ? entity : null)),
    findWorkTypeDetailById: jest.fn(async () => opts.detail !== undefined ? opts.detail : workTypeDetail()),
    findActiveChecklistTemplatesByWorkTypeId: jest.fn(async () => opts.rows !== undefined ? opts.rows : templates()),
    findChecklistItemsByTemplateIds: jest.fn(async (ids: string[]) =>
      (opts.items ??
        ids.flatMap((id) => [
          { templateId: id, sequenceNo: 1, title: 'Muc 1', description: null, answerType: 'YES_NO', isRequired: true, isBlocking: false, requiresPhoto: false, minValue: null, maxValue: null },
        ])),
    ),
    hasActiveAssignmentByWorkOrderIds: jest.fn(async (ids: string[]) =>
      new Set(ids.filter(() => opts.assigned === true)),
    ),
    findWorkTypeRefs: jest.fn(async () => new Map()),
    findProjectRefs: jest.fn(async (ids: string[]) => new Map(ids.map((id) => [id, { id, code: 'PRJ-001', name: 'Du an 1' }]))),
    findAreaRefs: jest.fn(async (ids: string[]) => new Map(ids.map((id) => [id, { id, code: 'A-01', name: 'Khu A' }]))),
    findTradeRefs: jest.fn(async (ids: string[]) => new Map(ids.map((id) => [id, { id, code: 'TR-01', name: 'Tho xay' }]))),
  } as unknown as WorkOrderRepositoryPort & Record<string, jest.Mock>;
  if (opts.stripMethod) {
    delete (repo as Record<string, unknown>)[opts.stripMethod];
  }
  const memberIds = opts.memberIds ?? [IDS.member];
  const scope = {
    assertProjectMemberScope: jest.fn(async ({ userId, actorRoles }: { userId: string; actorRoles: string[] }) => {
      if ((actorRoles ?? []).includes('ADMIN')) return { isAdminBypass: true };
      if (memberIds.includes(userId)) return { isAdminBypass: false };
      throw new ForbiddenException('Không có quyền truy cập dự án này');
    }),
  };
  const uc = new GetJobBoardDetailUseCase(repo, scope as never);
  return { uc, repo, scope };
}

describe('GetJobBoardDetailUseCase (JOB-SRS-007 #47)', () => {
  it('member (kể cả WORKER) 200 đủ sections: scope TRƯỚC enrich', async () => {
    const { uc, repo, scope } = setup();
    const out = await uc.execute({ workOrderId: IDS.wo, actorUserId: IDS.member, actorRoles: ['WORKER'] });
    expect(scope.assertProjectMemberScope).toHaveBeenCalledWith(expect.objectContaining({ projectId: IDS.project }));
    expect(out.entity.id).toBe(IDS.wo);
    expect(out.workTypeDetail.name).toBe('Do be tong');
    expect(out.workTypeDetail.requiredFields).toEqual([{ key: 'dien_tich', label: 'Dien tich', type: 'number' }]);
    expect(out.projectRef?.name).toBe('Du an 1');
    expect(out.areaRef?.name).toBe('Khu A');
    expect(out.tradeRef?.name).toBe('Tho xay');
    expect(out.checklists).toHaveLength(2);
    expect(out.checklists[0].code).toBe('CL-GEN');
    expect(out.checklists[1].code).toBe('CL-PRE');
    expect(out.checklists[0].items).toHaveLength(1);
    expect(out.hasActiveAssignment).toBe(false);
    expect(out.now).toBeInstanceOf(Date);
    expect(repo.findWorkTypeDetailById).toHaveBeenCalledWith(IDS.workType);
    expect(repo.findActiveChecklistTemplatesByWorkTypeId).toHaveBeenCalledWith(IDS.workType);
  });

  it('non-member: id tồn tại hay missing đều 403 generic (anti-leak), KHÔNG fetch related', async () => {
    const { uc, repo } = setup({ memberIds: [] });
    await expect(
      uc.execute({ workOrderId: IDS.wo, actorUserId: IDS.outsider, actorRoles: ['WORKER'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      uc.execute({ workOrderId: IDS.missing, actorUserId: IDS.outsider, actorRoles: ['WORKER'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.findWorkTypeDetailById).not.toHaveBeenCalled();
    expect(repo.findActiveChecklistTemplatesByWorkTypeId).not.toHaveBeenCalled();
  });

  it('ADMIN: tồn tại → bypass; missing → 404', async () => {
    const { uc, scope } = setup({ memberIds: [] });
    const out = await uc.execute({ workOrderId: IDS.wo, actorUserId: IDS.admin, actorRoles: ['ADMIN'] });
    expect(out.entity.id).toBe(IDS.wo);
    expect(scope.assertProjectMemberScope).toHaveBeenCalledWith(expect.objectContaining({ projectId: IDS.project }));
    await expect(
      uc.execute({ workOrderId: IDS.missing, actorUserId: IDS.admin, actorRoles: ['ADMIN'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('state derive với now capture 1 lần: until quá khứ → mapper ASSIGNED/EXPIRED đúng', async () => {
    const { uc } = setup({ assigned: true });
    const out = await uc.execute({ workOrderId: IDS.wo, actorUserId: IDS.member, actorRoles: ['WORKER'] });
    expect(out.hasActiveAssignment).toBe(true);
    expect(out.now).toBeInstanceOf(Date);
  });

  it('checklist rỗng → checklists [] (empty state, không lỗi)', async () => {
    const { uc, repo } = setup({ rows: [] });
    const out = await uc.execute({ workOrderId: IDS.wo, actorUserId: IDS.member, actorRoles: ['WORKER'] });
    expect(out.checklists).toEqual([]);
    expect(repo.findChecklistItemsByTemplateIds).not.toHaveBeenCalled();
  });

  it('work type không resolve → 409 JOB_BOARD_CONFIG_INVALID (withheld detail)', async () => {
    const { uc } = setup({ detail: null });
    const err = await uc.execute({ workOrderId: IDS.wo, actorUserId: IDS.member, actorRoles: ['WORKER'] }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({ statusCode: 409, code: 'JOB_BOARD_CONFIG_INVALID' });
  });

  it.each(['findWorkTypeDetailById', 'findActiveChecklistTemplatesByWorkTypeId', 'findChecklistItemsByTemplateIds', 'hasActiveAssignmentByWorkOrderIds'] as const)(
    'thiếu port method %s → 500 fail-closed (không fail-open)',
    async (method) => {
      const { uc } = setup({ stripMethod: method });
      await expect(
        uc.execute({ workOrderId: IDS.wo, actorUserId: IDS.member, actorRoles: ['WORKER'] }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    },
  );

  it('DRAFT/INACTIVE template bị loại khỏi resolve (policy defensive, mock bypass SQL)', async () => {
    const { uc } = setup({
      rows: [
        { id: IDS.clPerType, code: 'CL-PRE', name: 'Kiem tra', workTypeId: IDS.workType, purpose: 'PRE_START', version: 1, description: null, status: 'ACTIVE' },
        { id: '99999999-9999-4999-8999-999999999999', code: 'CL-DRAFT', name: 'Nhap', workTypeId: IDS.workType, purpose: 'PRE_START', version: 1, description: null, status: 'DRAFT' },
        { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab', code: 'CL-OFF', name: 'Cu', workTypeId: null, purpose: 'WORK_DONE', version: 1, description: null, status: 'INACTIVE' },
      ],
    });
    const out = await uc.execute({ workOrderId: IDS.wo, actorUserId: IDS.member, actorRoles: ['WORKER'] });
    expect(out.checklists).toHaveLength(1);
    expect(out.checklists[0]).toMatchObject({ id: IDS.clPerType, code: 'CL-PRE', purpose: 'PRE_START', version: 1 });
  });
});
