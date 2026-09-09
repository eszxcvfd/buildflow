import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CloseWorkOrderJobBoardUseCase } from './close-work-order-job-board.use-case';
import { WorkOrderEntity, WorkOrderStatus } from '../../domain/entity/work-order.entity';
import { WorkOrderRepositoryPort } from '../../domain/repository/work-order-repository.port';

const IDS = {
  wo: '11111111-1111-4111-8111-111111111111',
  missing: '00000000-0000-4000-8000-000000000000',
  project: '22222222-2222-4222-8222-222222222222',
  workType: '44444444-4444-4444-8444-444444444444',
  actor: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

function makeEntity(status: WorkOrderStatus = 'OPEN', version = 1, board = true): WorkOrderEntity {
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

function setup(opts: {
  status?: WorkOrderStatus;
  version?: number;
  board?: boolean;
  assigned?: boolean;
  guardRowCount?: number;
  auditFail?: boolean;
} = {}) {
  const current = makeEntity(opts.status ?? 'OPEN', opts.version ?? 1, opts.board ?? true);
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
  const tx = { withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn(client)) };
  const scope = { assertProjectWriteScope: jest.fn(async () => ({ isAdminBypass: false })) };
  const uc = new CloseWorkOrderJobBoardUseCase(repo, audit as never, tx as never, scope as never);
  return { uc, repo, audit, tx, scope, auditCalls, historyCalls };
}

const BASE = { workOrderId: IDS.wo, actorUserId: IDS.actor, actorRoles: ['PROJECT_MANAGER'] };

describe('CloseWorkOrderJobBoardUseCase (JOB-SRS-004)', () => {
  it('scope write trên project WO; missing → non-ADMIN 403, ADMIN 404', async () => {
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

  it('OPEN + board mở → 200 READY + flag=false + from/until GIỮ + version+1 + audit + history', async () => {
    const { uc, auditCalls, historyCalls, repo } = setup();
    const { entity, alreadyClosed } = await uc.execute({ ...BASE, expectedVersion: 1, reason: 'Tạm dừng' });
    expect(alreadyClosed).toBe(false);
    expect(entity.status).toBe('READY');
    expect(entity.jobBoardOpen).toBe(false);
    expect(entity.jobBoardOpenFrom?.toISOString()).toBe('2026-10-15T08:00:00.000Z');
    expect(entity.jobBoardOpenUntil?.toISOString()).toBe('2026-10-20T08:00:00.000Z');
    expect(entity.version).toBe(2);
    expect(repo.updateJobBoardWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ workOrderId: IDS.wo, jobBoardOpen: false, expectedVersion: 1 }),
    );
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]).toMatchObject({
      action: 'JOB_BOARD_CLOSED',
      beforeData: expect.objectContaining({ status: 'OPEN', jobBoardOpen: true, version: 1 }),
      afterData: expect.objectContaining({ status: 'READY', jobBoardOpen: false, version: 2 }),
      reason: 'Tạm dừng',
    });
    expect(historyCalls).toHaveLength(1);
    expect(historyCalls[0]).toMatchObject({ fromStatus: 'OPEN', toStatus: 'READY', reason: 'Tạm dừng' });
  });

  it('board đã đóng → alreadyClosed (không audit mới; pre-check không mở tx)', async () => {
    const { uc, tx, auditCalls } = setup({ status: 'READY', board: false });
    const { entity, alreadyClosed } = await uc.execute({ ...BASE });
    expect(alreadyClosed).toBe(true);
    expect(entity.jobBoardOpen).toBe(false);
    expect(tx.withTransaction).not.toHaveBeenCalled();
    expect(auditCalls).toHaveLength(0);
  });

  it('AC3: close KHÔNG đụng assignments (row giữ nguyên)', async () => {
    const { uc, repo } = setup({ assigned: true });
    const { entity } = await uc.execute({ ...BASE });
    expect(entity.jobBoardOpen).toBe(false);
    expect(entity.status).toBe('READY');
    // Không query write nào vào bảng assignments (mock client chỉ nhận audit/history qua port).
    expect(repo.hasActiveAssignmentByWorkOrderIds).toHaveBeenCalledWith([IDS.wo]);
  });

  it('F013: race row tươi CANCELLED + board mở → 400 WORK_ORDER_STATUS_NOT_CLOSABLE', async () => {
    const { uc, repo } = setup({ guardRowCount: 0 });
    const cancelledOpen = WorkOrderEntity.fromPersistence({
      ...makeEntity('CANCELLED', 2, true).getProps(),
    });
    (repo.findById as jest.Mock).mockResolvedValue(cancelledOpen);
    const err = await uc.execute({ ...BASE }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toMatchObject({
      code: 'WORK_ORDER_STATUS_NOT_CLOSABLE',
      fieldErrors: { status: expect.anything() },
    });
  });

  it('F001: port thiếu hasActiveAssignmentByWorkOrderIds → 500 fail-closed', async () => {
    const { uc, repo } = setup();
    delete (repo as unknown as Record<string, unknown>).hasActiveAssignmentByWorkOrderIds;
    await expect(uc.execute({ ...BASE })).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('stale version → 409 WORK_ORDER_CONFLICT', async () => {
    const { uc } = setup({ version: 2 });
    const err = await uc.execute({ ...BASE, expectedVersion: 1 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({ code: 'WORK_ORDER_CONFLICT' });
  });

  it('audit fail → 500 rollback', async () => {
    const { uc } = setup({ auditFail: true });
    await expect(uc.execute({ ...BASE })).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('reason >500 → 400 fieldErrors {reason}', async () => {
    const { uc } = setup();
    const err = await uc.execute({ ...BASE, reason: 'y'.repeat(501) }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toMatchObject({
      fieldErrors: { reason: expect.anything() },
    });
  });

  it('F020: expectedVersion non-number (string/float/boolean) → 400 VERSION_INVALID', async () => {
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

  it('F021: reason non-string non-null (number/boolean/object) → 400 fieldErrors {reason}', async () => {
    const { uc } = setup();
    for (const reason of [123, true, {}] as unknown[]) {
      const err = await uc.execute({ ...BASE, reason: reason as never }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({
        fieldErrors: { reason: expect.anything() },
      });
    }
  });
});
