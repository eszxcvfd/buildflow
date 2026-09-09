import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { UpdateWorkOrderUseCase } from './update-work-order.use-case';
import { WorkOrderEntity, WorkOrderStatus } from '../../domain/entity/work-order.entity';
import { WorkOrderRepositoryPort } from '../../domain/repository/work-order-repository.port';

const IDS = {
  wo: '11111111-1111-4111-8111-111111111111',
  missing: '00000000-0000-4000-8000-000000000000',
  project: '22222222-2222-4222-8222-222222222222',
  workType: '44444444-4444-4444-8444-444444444444',
  otherWorkType: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
  trade: '55555555-5555-4555-8555-555555555555',
  actor: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

function makeEntity(status: WorkOrderStatus = 'DRAFT', version = 1): WorkOrderEntity {
  return new WorkOrderEntity({
    id: IDS.wo,
    code: 'WO-2026-A1',
    projectId: IDS.project,
    areaId: null,
    workTypeId: IDS.workType,
    requiredTradeId: null,
    title: 'Đổ bê tông cột C1',
    description: 'Mô tả cũ',
    instructions: null,
    priority: 'NORMAL',
    status,
    plannedStartAt: new Date('2026-10-01T08:00:00.000Z'),
    plannedEndAt: new Date('2026-10-02T08:00:00.000Z'),
    dueAt: null,
    plannedHeadcount: null,
    customFields: {},
    createdBy: IDS.actor,
    version,
    requestKey: null,
    jobBoardOpen: false,
    jobBoardOpenFrom: null,
    jobBoardOpenUntil: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

function setup(status: WorkOrderStatus = 'DRAFT', version = 1, failNotifications = false) {
  let current = makeEntity(status, version);
  const queries: Array<{ text: string; params: unknown[] }> = [];
  const client = {
    query: jest.fn(async (text: string, params: unknown[]) => {
      queries.push({ text, params });
      if (failNotifications && text.includes('public.notifications')) {
        throw new Error('notification insert down');
      }
      return { rowCount: 1 };
    }),
  };
  const auditCalls: unknown[] = [];
  const repo = {
    findById: jest.fn(async (id: string) => (id === IDS.wo ? current : null)),
    findActiveWorkTypeById: jest.fn(async (id: string) => ({ id, isActive: true })),
    findActiveTradeById: jest.fn(async (id: string) => ({ id, isActive: true })),
    findWorkTypeNameById: jest.fn(async () => 'Đổ bê tông'),
    updateWithClient: jest.fn(async (_c: unknown, e: WorkOrderEntity) => {
      current = e;
      return 1;
    }),
  } as unknown as WorkOrderRepositoryPort & { updateWithClient: jest.Mock };
  const audit = {
    log: jest.fn(async () => {}),
    logWithClient: jest.fn(async (_c: unknown, p: unknown) => {
      auditCalls.push(p);
    }),
  };
  const tx = { withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn(client)) };
  const scope = { assertProjectWriteScope: jest.fn(async () => ({ isAdminBypass: false })) };
  const uc = new UpdateWorkOrderUseCase(repo, audit as never, tx as never, scope as never);
  return { uc, repo, audit, tx, scope, queries, auditCalls, getCurrent: () => current };
}

const BASE = { workOrderId: IDS.wo, actorUserId: IDS.actor, actorRoles: ['PROJECT_MANAGER'] };

describe('UpdateWorkOrderUseCase (JOB-SRS-003)', () => {
  it('scope trên project của WO (write); missing → non-ADMIN 403, ADMIN 404', async () => {
    const { uc, scope } = setup();
    await uc.execute({ ...BASE, description: 'Mới' });
    expect(scope.assertProjectWriteScope).toHaveBeenCalledWith(expect.objectContaining({ projectId: IDS.project }));

    const { uc: ucMissing } = setup();
    await expect(ucMissing.execute({ ...BASE, workOrderId: IDS.missing, description: 'X' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const { uc: ucAdmin } = setup();
    await expect(
      ucAdmin.execute({ ...BASE, workOrderId: IDS.missing, actorRoles: ['ADMIN'], description: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('DRAFT happy: description → version+1, audit UPDATED before/after, không notification', async () => {
    const { uc, auditCalls, queries } = setup('DRAFT');
    const { entity, exceptionEdit, noOp } = await uc.execute({ ...BASE, description: 'Mô tả mới', expectedVersion: 1 });
    expect(entity.version).toBe(2);
    expect(entity.description).toBe('Mô tả mới');
    expect(exceptionEdit).toBe(false);
    expect(noOp).toBe(false);
    expect(auditCalls).toHaveLength(1);
    const payload = auditCalls[0] as Record<string, unknown>;
    expect(payload['action']).toBe('JOB_WORK_ORDER_UPDATED');
    expect(payload['beforeData']).toEqual({ description: 'Mô tả cũ' });
    expect(payload['afterData']).toEqual({ description: 'Mô tả mới' });
    expect(queries.filter((q) => q.text.includes('notifications'))).toHaveLength(0);
  });

  it('OPEN đổi schedule → 400 WORK_ORDER_FIELD_LOCKED; đổi dueAt → 200', async () => {
    const { uc } = setup('OPEN');
    const err = await uc
      .execute({ ...BASE, plannedStartAt: '2026-11-01T08:00:00.000Z' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toMatchObject({
      code: 'WORK_ORDER_FIELD_LOCKED',
      fieldErrors: { plannedStartAt: expect.anything() },
    });

    const { uc: uc2 } = setup('OPEN');
    const { entity } = await uc2.execute({ ...BASE, dueAt: '2026-12-01T08:00:00.000Z' });
    expect(entity.dueAt?.toISOString()).toBe('2026-12-01T08:00:00.000Z');
  });

  it('ASSIGNED đổi schedule thiếu reason → 400 REASON_REQUIRED; kèm reason → 200 + notification + audit before/after đầy đủ', async () => {
    const { uc } = setup('ASSIGNED');
    const err = await uc
      .execute({ ...BASE, plannedEndAt: '2026-10-05T08:00:00.000Z' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toMatchObject({
      code: 'WORK_ORDER_REASON_REQUIRED',
      fieldErrors: { reason: expect.anything() },
    });

    const env = setup('ASSIGNED');
    const { entity } = await env.uc.execute({
      ...BASE,
      plannedEndAt: '2026-10-05T08:00:00.000Z',
      reason: 'Dời lịch theo yêu cầu CĐT',
    });
    expect(entity.version).toBe(2);
    // Audit before/after đầy đủ 2 phía cho đổi lịch.
    expect(env.auditCalls).toHaveLength(1);
    const payload = env.auditCalls[0] as Record<string, unknown>;
    expect(payload['beforeData']).toEqual({ plannedEndAt: '2026-10-02T08:00:00.000Z' });
    expect(payload['afterData']).toEqual({ plannedEndAt: '2026-10-05T08:00:00.000Z' });
    expect(payload['reason']).toBe('Dời lịch theo yêu cầu CĐT');
    // 1 notification row cho creator trong tx, dedup_key hash woId+fields+version.
    const notifs = env.queries.filter((q) => q.text.includes('public.notifications'));
    expect(notifs).toHaveLength(1);
    expect(notifs[0].params[0]).toBe(IDS.actor);
    expect(String(notifs[0].params[6])).toMatch(/^woupd-[0-9a-f]{64}$/);
  });

  it('WORK_DONE: non-ADMIN 400 FIELD_LOCKED; ADMIN thiếu reason 400; ADMIN + reason ≥10 → 200 EXCEPTION_EDIT', async () => {
    const { uc } = setup('WORK_DONE');
    const err = await uc.execute({ ...BASE, description: 'X' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toMatchObject({ code: 'WORK_ORDER_FIELD_LOCKED' });

    const adminBase = { ...BASE, actorRoles: ['ADMIN'] };
    const env = setup('WORK_DONE');
    await expect(env.uc.execute({ ...adminBase, description: 'X' })).rejects.toBeInstanceOf(BadRequestException);

    const env2 = setup('WORK_DONE');
    const { entity, exceptionEdit } = await env2.uc.execute({
      ...adminBase,
      description: 'Hiệu chỉnh ngoại lệ',
      reason: 'Sửa sai mã cần hiệu chỉnh',
    });
    expect(exceptionEdit).toBe(true);
    expect(entity.description).toBe('Hiệu chỉnh ngoại lệ');
    const payload = env2.auditCalls[0] as Record<string, unknown>;
    expect(payload['action']).toBe('WORK_ORDER_EXCEPTION_EDIT');
  });

  it('expectedVersion lệch → 409 WORK_ORDER_CONFLICT (pre-check); SQL guard rowCount 0 → 409', async () => {
    const { uc, repo } = setup('DRAFT', 3);
    const err = await uc.execute({ ...BASE, description: 'X', expectedVersion: 2 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({ code: 'WORK_ORDER_CONFLICT' });
    expect(repo.updateWithClient).not.toHaveBeenCalled();

    const env = setup('DRAFT', 3);
    (env.repo.updateWithClient as jest.Mock).mockResolvedValueOnce(0);
    await expect(env.uc.execute({ ...BASE, description: 'X', expectedVersion: 3 })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'WORK_ORDER_CONFLICT' }),
    });
  });

  it('workTypeId không tồn tại/inactive → 400; schedule range sai → 400 plannedEndAt; no-op trùng giá trị → không tx/audit', async () => {
    const env = setup('DRAFT');
    (env.repo.findActiveWorkTypeById as jest.Mock).mockResolvedValueOnce(null);
    await expect(env.uc.execute({ ...BASE, workTypeId: IDS.otherWorkType })).rejects.toMatchObject({
      response: expect.objectContaining({ fieldErrors: expect.objectContaining({ workTypeId: expect.anything() }) }),
    });

    const env2 = setup('DRAFT');
    await expect(
      env2.uc.execute({
        ...BASE,
        plannedStartAt: '2026-10-05T08:00:00.000Z',
        plannedEndAt: '2026-10-01T08:00:00.000Z',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ fieldErrors: expect.objectContaining({ plannedEndAt: expect.anything() }) }),
    });

    const env3 = setup('DRAFT');
    const out = await env3.uc.execute({ ...BASE, description: 'Mô tả cũ' });
    expect(out.noOp).toBe(true);
    expect(env3.tx.withTransaction).not.toHaveBeenCalled();
  });

  it('J8 PATCH customFields partial merge (key absent giữ nguyên); object rỗng = no-op', async () => {
    const env = setup('DRAFT');
    const first = await env.uc.execute({ ...BASE, customFields: { dien_tich: 120 } });
    expect(first.entity.version).toBe(2);
    expect(first.entity.customFields).toEqual({ dien_tich: 120 });

    const second = await env.uc.execute({ ...BASE, customFields: { anh_nghiem_thu: 'https://cdn.example/a.jpg' } });
    expect(second.entity.customFields).toEqual({ dien_tich: 120, anh_nghiem_thu: 'https://cdn.example/a.jpg' });

    const noop = await env.uc.execute({ ...BASE, customFields: {} });
    expect(noop.noOp).toBe(true);
  });

  it('J8 đổi workTypeId không gửi trade → auto-fill ngành loại mới; gửi sai/gỡ null khi yêu cầu → 400', async () => {
    const env = setup('DRAFT');
    (env.repo.findActiveWorkTypeById as jest.Mock).mockResolvedValue({ id: IDS.otherWorkType, isActive: true, requiredTradeId: IDS.trade });
    const { entity } = await env.uc.execute({ ...BASE, workTypeId: IDS.otherWorkType });
    expect(entity.workTypeId).toBe(IDS.otherWorkType);
    expect(entity.requiredTradeId).toBe(IDS.trade);

    const env2 = setup('DRAFT');
    (env2.repo.findActiveWorkTypeById as jest.Mock).mockResolvedValue({ id: IDS.otherWorkType, isActive: true, requiredTradeId: IDS.trade });
    await expect(
      env2.uc.execute({ ...BASE, workTypeId: IDS.otherWorkType, requiredTradeId: '99999999-9999-4999-8999-999999999999' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ fieldErrors: expect.objectContaining({ requiredTradeId: expect.anything() }) }),
    });

    const env3 = setup('DRAFT');
    (env3.repo.findActiveWorkTypeById as jest.Mock).mockResolvedValue({ id: IDS.workType, isActive: true, requiredTradeId: IDS.trade });
    await expect(env3.uc.execute({ ...BASE, requiredTradeId: null })).rejects.toMatchObject({
      response: expect.objectContaining({ fieldErrors: expect.objectContaining({ requiredTradeId: expect.anything() }) }),
    });
  });

  it('audit fail → 500; notification fail → 500 (rollback)', async () => {
    const env = setup('ASSIGNED');
    (env.audit.logWithClient as jest.Mock).mockRejectedValueOnce(new Error('audit down'));
    await expect(
      env.uc.execute({ ...BASE, plannedEndAt: '2026-10-05T08:00:00.000Z', reason: 'Dời lịch' }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    const env2 = setup('ASSIGNED', 1, true);
    await expect(
      env2.uc.execute({ ...BASE, plannedEndAt: '2026-10-05T08:00:00.000Z', reason: 'Dời lịch' }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
