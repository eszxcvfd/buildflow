import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { OpenWorkOrderJobBoardUseCase } from './open-work-order-job-board.use-case';
import { WorkOrderEntity, WorkOrderStatus } from '../../domain/entity/work-order.entity';
import { WorkOrderRepositoryPort } from '../../domain/repository/work-order-repository.port';
import { PublishCheckSnapshot } from '../../domain/service/work-order-publish-check.policy';

const IDS = {
  wo: '11111111-1111-4111-8111-111111111111',
  missing: '00000000-0000-4000-8000-000000000000',
  project: '22222222-2222-4222-8222-222222222222',
  workType: '44444444-4444-4444-8444-444444444444',
  actor: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

function makeEntity(status: WorkOrderStatus = 'DRAFT', version = 1, board = false): WorkOrderEntity {
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
    jobBoardOpen: board,
    jobBoardOpenFrom: board ? new Date('2026-10-15T08:00:00.000Z') : null,
    jobBoardOpenUntil: board ? new Date('2026-10-20T08:00:00.000Z') : null,
    createdBy: IDS.actor,
    version,
    requestKey: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

function readySnapshot(entity: WorkOrderEntity): PublishCheckSnapshot {
  return {
    workOrder: {
      id: entity.id,
      projectId: entity.projectId,
      areaId: null,
      requiredTradeId: null,
      title: entity.title,
      code: entity.code,
      description: entity.description,
      instructions: null,
      priority: 'NORMAL',
      status: entity.status,
      plannedStartAt: new Date('2026-10-01T08:00:00.000Z'),
      plannedEndAt: new Date('2026-10-02T08:00:00.000Z'),
      plannedHeadcount: null,
      jobBoardOpen: entity.jobBoardOpen,
      customFields: {},
    },
    project: { id: IDS.project, status: 'ACTIVE' },
    workType: { id: IDS.workType, isActive: true, requiredTradeId: null, requiredFieldsRaw: [] },
    area: null,
    workTypeTrade: null,
    workOrderTrade: null,
  };
}

function setup(opts: {
  status?: WorkOrderStatus;
  version?: number;
  board?: boolean;
  assigned?: boolean;
  guardRowCount?: number;
  auditFail?: boolean;
  historyFail?: boolean;
} = {}) {
  const current = makeEntity(opts.status ?? 'DRAFT', opts.version ?? 1, opts.board ?? false);
  const assigned = opts.assigned ?? false;
  const client = { query: jest.fn(async () => ({ rowCount: 1 })) };
  const auditCalls: unknown[] = [];
  const historyCalls: unknown[] = [];
  const repo = {
    findById: jest.fn(async (id: string) => (id === IDS.wo ? current : null)),
    findWorkTypeNameById: jest.fn(async () => 'Đổ bê tông'),
    hasActiveAssignmentByWorkOrderIds: jest.fn(async (ids: string[]) => new Set(ids.filter(() => assigned))),
    updateJobBoardWithClient: jest.fn(async () => opts.guardRowCount ?? 1),
    insertStateHistoryWithClient: jest.fn(async (_c: unknown, p: unknown) => {
      if (opts.historyFail) throw new Error('history down');
      historyCalls.push(p);
    }),
  } as unknown as WorkOrderRepositoryPort & {
    updateJobBoardWithClient: jest.Mock;
    insertStateHistoryWithClient: jest.Mock;
    hasActiveAssignmentByWorkOrderIds: jest.Mock;
  };
  const audit = {
    log: jest.fn(async () => {}),
    logWithClient: jest.fn(async (_c: unknown, p: unknown) => {
      if (opts.auditFail) throw new Error('audit down');
      auditCalls.push(p);
    }),
  };
  const read = { fetchSnapshot: jest.fn(async () => readySnapshot(current)) };
  const tx = { withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn(client)) };
  const scope = { assertProjectWriteScope: jest.fn(async () => ({ isAdminBypass: false })) };
  const uc = new OpenWorkOrderJobBoardUseCase(repo, read as never, audit as never, tx as never, scope as never);
  return { uc, repo, audit, read, tx, scope, auditCalls, historyCalls };
}

const BASE = {
  workOrderId: IDS.wo,
  actorUserId: IDS.actor,
  actorRoles: ['PROJECT_MANAGER'],
  jobBoardOpenFrom: '2026-10-15T08:00:00.000Z',
  jobBoardOpenUntil: '2026-10-20T08:00:00.000Z',
};

describe('OpenWorkOrderJobBoardUseCase (JOB-SRS-004)', () => {
  it('scope-first write trên project WO; missing → non-ADMIN 403, ADMIN 404', async () => {
    const { uc, scope } = setup();
    await uc.execute({ ...BASE });
    expect(scope.assertProjectWriteScope).toHaveBeenCalledWith(expect.objectContaining({ projectId: IDS.project }));

    const { uc: ucMissing } = setup();
    await expect(ucMissing.execute({ ...BASE, workOrderId: IDS.missing })).rejects.toBeInstanceOf(ForbiddenException);
    const { uc: ucAdmin } = setup();
    await expect(
      ucAdmin.execute({ ...BASE, workOrderId: IDS.missing, actorRoles: ['ADMIN'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('DRAFT đủ điều kiện → 200 OPEN + flag/window/version+1 + audit + state_history', async () => {
    const { uc, auditCalls, historyCalls, repo } = setup();
    const { entity, alreadyOpen, hasActiveAssignment } = await uc.execute({ ...BASE, expectedVersion: 1 });
    expect(alreadyOpen).toBe(false);
    expect(hasActiveAssignment).toBe(false);
    expect(entity.status).toBe('OPEN');
    expect(entity.jobBoardOpen).toBe(true);
    expect(entity.jobBoardOpenFrom?.toISOString()).toBe('2026-10-15T08:00:00.000Z');
    expect(entity.jobBoardOpenUntil?.toISOString()).toBe('2026-10-20T08:00:00.000Z');
    expect(entity.version).toBe(2);
    expect(repo.updateJobBoardWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ workOrderId: IDS.wo, jobBoardOpen: true, toStatus: 'OPEN', expectedVersion: 1 }),
    );
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]).toMatchObject({
      action: 'JOB_BOARD_OPENED',
      entityType: 'WORK_ORDER',
      beforeData: expect.objectContaining({ status: 'DRAFT', jobBoardOpen: false, version: 1 }),
      afterData: expect.objectContaining({ status: 'OPEN', jobBoardOpen: true, version: 2 }),
    });
    expect(historyCalls).toHaveLength(1);
    expect(historyCalls[0]).toMatchObject({ fromStatus: 'DRAFT', toStatus: 'OPEN' });
  });

  it('re-open OPEN + board đóng → status giữ, KHÔNG state_history', async () => {
    const { uc, historyCalls } = setup({ status: 'OPEN' });
    const { entity } = await uc.execute({ ...BASE });
    expect(entity.status).toBe('OPEN');
    expect(entity.jobBoardOpen).toBe(true);
    expect(historyCalls).toHaveLength(0);
  });

  it('replay cùng window → alreadyOpen (không audit mới; pre-check không mở tx)', async () => {
    const { uc, tx, auditCalls } = setup({ status: 'OPEN', board: true });
    const { entity, alreadyOpen } = await uc.execute({ ...BASE });
    expect(alreadyOpen).toBe(true);
    expect(entity.jobBoardOpen).toBe(true);
    expect(tx.withTransaction).not.toHaveBeenCalled();
    expect(auditCalls).toHaveLength(0);
  });

  it('F003: request KHÔNG gửi jobBoardOpenFrom + board đang mở → replay alreadyOpen (không 409)', async () => {
    // Board đang mở với window 15→20; request không gửi from (server default
    // now) là replay intent — trả 200 alreadyOpen kèm window hiện tại.
    const { uc, tx, auditCalls } = setup({ status: 'OPEN', board: true });
    const { entity, alreadyOpen } = await uc.execute({
      workOrderId: IDS.wo,
      actorUserId: IDS.actor,
      actorRoles: ['PROJECT_MANAGER'],
      jobBoardOpenUntil: '2026-12-15T08:00:00.000Z',
    });
    expect(alreadyOpen).toBe(true);
    expect(entity.jobBoardOpen).toBe(true);
    expect(entity.jobBoardOpenFrom?.toISOString()).toBe('2026-10-15T08:00:00.000Z');
    expect(tx.withTransaction).not.toHaveBeenCalled();
    expect(auditCalls).toHaveLength(0);
  });

  it('F016: explicit window lệch ms dù cùng giây → 409 JOB_BOARD_ALREADY_OPEN (full-ms)', async () => {
    const boarded = WorkOrderEntity.fromPersistence({
      ...makeEntity('OPEN', 1, true).getProps(),
      jobBoardOpenFrom: new Date('2026-10-15T08:00:00.100Z'),
    });
    const { uc, repo } = setup({ status: 'OPEN', board: true });
    (repo.findById as jest.Mock).mockResolvedValue(boarded);
    const err = await uc
      .execute({
        ...BASE,
        jobBoardOpenFrom: '2026-10-15T08:00:00.900Z',
        jobBoardOpenUntil: '2026-10-20T08:00:00.000Z',
      })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({ code: 'JOB_BOARD_ALREADY_OPEN' });
  });

  it('F015: race-path 2 POST {} (không from) — loser guardRowCount=0 → 200 alreadyOpen (không 409)', async () => {
    const { uc, repo, tx, auditCalls, historyCalls } = setup({ status: 'DRAFT', guardRowCount: 0 });
    const winner = makeEntity('OPEN', 2, true);
    (repo.findById as jest.Mock)
      .mockResolvedValueOnce(makeEntity('DRAFT', 1, false))
      .mockResolvedValue(winner);
    const { entity, alreadyOpen } = await uc.execute({
      workOrderId: IDS.wo,
      actorUserId: IDS.actor,
      actorRoles: ['PROJECT_MANAGER'],
    });
    expect(alreadyOpen).toBe(true);
    expect(entity.jobBoardOpen).toBe(true);
    expect(tx.withTransaction).toHaveBeenCalled();
    expect(auditCalls).toHaveLength(0);
    expect(historyCalls).toHaveLength(0);
  });

  it('F017: loser-path guardRowCount=0 + row tươi winner same-window → alreadyOpen + 0 audit + 0 history', async () => {
    const { uc, repo, auditCalls, historyCalls } = setup({ status: 'DRAFT', guardRowCount: 0 });
    const winner = WorkOrderEntity.fromPersistence({
      ...makeEntity('OPEN', 2, true).getProps(),
      jobBoardOpenFrom: new Date('2026-10-15T08:00:00.000Z'),
      jobBoardOpenUntil: new Date('2026-10-20T08:00:00.000Z'),
    });
    (repo.findById as jest.Mock)
      .mockResolvedValueOnce(makeEntity('DRAFT', 1, false))
      .mockResolvedValue(winner);
    const { entity, alreadyOpen } = await uc.execute({ ...BASE });
    expect(alreadyOpen).toBe(true);
    expect(entity.version).toBe(2);
    expect(entity.jobBoardOpen).toBe(true);
    expect(auditCalls).toHaveLength(0);
    expect(historyCalls).toHaveLength(0);
  });

  it('F022/F024: race-path same-window + expectedVersion stale so với row tươi → alreadyOpen (idempotency-wins, không 409)', async () => {
    const { uc, repo, auditCalls } = setup({ status: 'DRAFT', version: 1, guardRowCount: 0 });
    const winner = WorkOrderEntity.fromPersistence({
      ...makeEntity('OPEN', 2, true).getProps(),
      jobBoardOpenFrom: new Date('2026-10-15T08:00:00.000Z'),
      jobBoardOpenUntil: new Date('2026-10-20T08:00:00.000Z'),
    });
    (repo.findById as jest.Mock)
      .mockResolvedValueOnce(makeEntity('DRAFT', 1, false))
      .mockResolvedValue(winner);
    const { alreadyOpen } = await uc.execute({ ...BASE, expectedVersion: 1 });
    expect(alreadyOpen).toBe(true);
    expect(auditCalls).toHaveLength(0);
  });

  it('F024: pre-check replay thắng kể cả version stale → 200 alreadyOpen (không 409)', async () => {
    const { uc, tx, auditCalls } = setup({ status: 'OPEN', board: true, version: 2 });
    const { alreadyOpen } = await uc.execute({ ...BASE, expectedVersion: 1 });
    expect(alreadyOpen).toBe(true);
    expect(tx.withTransaction).not.toHaveBeenCalled();
    expect(auditCalls).toHaveLength(0);
  });

  it('F019: from non-string (array/number/boolean) → 400 JOB_BOARD_WINDOW_INVALID', async () => {
    const { uc } = setup();
    for (const from of [['2026-10-06T08:00'], 2026, true] as unknown[]) {
      const err = await uc.execute({ ...BASE, jobBoardOpenFrom: from }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({
        code: 'JOB_BOARD_WINDOW_INVALID',
        fieldErrors: { jobBoardOpenFrom: expect.anything() },
      });
    }
  });

  it('F020: expectedVersion non-number (string/float) → 400 VERSION_INVALID', async () => {
    const { uc } = setup();
    for (const expectedVersion of ['1', 1.5, true] as unknown[]) {
      const err = await uc.execute({ ...BASE, expectedVersion: expectedVersion as never }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({
        code: 'JOB_BOARD_VERSION_INVALID',
        fieldErrors: { expectedVersion: expect.anything() },
      });
    }
  });

  it('F021: reason non-string non-null (number/boolean/object) → 400', async () => {
    const { uc } = setup();
    for (const reason of [123, true, {}] as unknown[]) {
      const err = await uc.execute({ ...BASE, reason: reason as never }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({
        fieldErrors: { reason: expect.anything() },
      });
    }
  });

  it('F001: port thiếu hasActiveAssignmentByWorkOrderIds → 500 fail-closed', async () => {
    const { uc, repo } = setup();
    delete (repo as unknown as Record<string, unknown>).hasActiveAssignmentByWorkOrderIds;
    await expect(uc.execute({ ...BASE })).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('AC4 race: snapshot tươi flag=true (winner commit giữa pre-check và re-check) → không 400 nhầm, guarded UPDATE trọng tài', async () => {
    const { uc, read } = setup();
    const raced = readySnapshot(makeEntity());
    read.fetchSnapshot.mockResolvedValueOnce({
      ...raced,
      workOrder: { ...raced.workOrder, status: 'OPEN', jobBoardOpen: true },
    });
    const { entity, alreadyOpen } = await uc.execute({ ...BASE });
    expect(alreadyOpen).toBe(false);
    expect(entity.status).toBe('OPEN');
    expect(entity.jobBoardOpen).toBe(true);
  });

  it('board mở window khác → 409 JOB_BOARD_ALREADY_OPEN', async () => {
    const { uc } = setup({ status: 'OPEN', board: true });
    const err = await uc.execute({ ...BASE, jobBoardOpenUntil: '2026-10-25T08:00:00.000Z' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({ code: 'JOB_BOARD_ALREADY_OPEN' });
  });

  it('có assignment → 409 JOB_BOARD_HAS_ASSIGNEE', async () => {
    const { uc } = setup({ assigned: true });
    const err = await uc.execute({ ...BASE }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({ code: 'JOB_BOARD_HAS_ASSIGNEE' });
  });

  it('CANCELLED/ASSIGNED → 400 WORK_ORDER_STATUS_NOT_OPENABLE', async () => {
    for (const status of ['CANCELLED', 'ASSIGNED', 'IN_PROGRESS', 'WORK_DONE', 'CLOSED'] as WorkOrderStatus[]) {
      const { uc } = setup({ status });
      const err = await uc.execute({ ...BASE }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({
        code: 'WORK_ORDER_STATUS_NOT_OPENABLE',
        fieldErrors: { status: expect.anything() },
      });
    }
  });

  it('thiếu điều kiện công bố → 400 WORK_ORDER_NOT_PUBLISHABLE + unmet[]', async () => {
    const { uc, read } = setup();
    read.fetchSnapshot.mockResolvedValueOnce({
      ...readySnapshot(makeEntity()),
      workOrder: { ...readySnapshot(makeEntity()).workOrder, plannedStartAt: null, plannedEndAt: null },
    });
    const err = await uc.execute({ ...BASE }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toMatchObject({
      code: 'WORK_ORDER_NOT_PUBLISHABLE',
      unmet: expect.any(Array),
    });
  });

  it('window sai: until<=from / until quá khứ / ISO sai → 400 JOB_BOARD_WINDOW_INVALID', async () => {
    const { uc } = setup();
    for (const body of [
      { jobBoardOpenFrom: '2026-10-20T08:00:00.000Z', jobBoardOpenUntil: '2026-10-20T08:00:00.000Z' },
      { jobBoardOpenFrom: '2026-01-01T08:00:00.000Z', jobBoardOpenUntil: '2026-02-01T08:00:00.000Z' },
      { jobBoardOpenFrom: 'not-a-date' },
    ]) {
      const err = await uc.execute({ ...BASE, ...body }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({ code: 'JOB_BOARD_WINDOW_INVALID' });
    }
  });

  it('stale version → 409 WORK_ORDER_CONFLICT (pre-check + guard rowCount=0)', async () => {
    const { uc } = setup({ version: 2 });
    const err = await uc.execute({ ...BASE, expectedVersion: 1 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({ code: 'WORK_ORDER_CONFLICT' });

    const raced = setup({ version: 1, guardRowCount: 0 });
    (raced.repo.findById as jest.Mock).mockResolvedValue(makeEntity('DRAFT', 2));
    const err2 = await raced.uc.execute({ ...BASE, expectedVersion: 1 }).catch((e: unknown) => e);
    expect(err2).toBeInstanceOf(ConflictException);
  });

  it('audit fail → 500 rollback; history fail → 500', async () => {
    const { uc } = setup({ auditFail: true });
    await expect(uc.execute({ ...BASE })).rejects.toBeInstanceOf(InternalServerErrorException);
    const { uc: uc2 } = setup({ historyFail: true });
    await expect(uc2.execute({ ...BASE })).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('reason >500 → 400 fieldErrors {reason}', async () => {
    const { uc } = setup();
    const err = await uc.execute({ ...BASE, reason: 'x'.repeat(501) }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toMatchObject({
      fieldErrors: { reason: expect.anything() },
    });
  });
});
