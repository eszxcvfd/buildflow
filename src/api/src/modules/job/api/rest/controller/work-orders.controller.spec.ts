import { BadRequestException } from '@nestjs/common';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrderEntity } from '../../../domain/entity/work-order.entity';

const IDS = {
  wo: '11111111-1111-4111-8111-111111111111',
  project: '22222222-2222-4222-8222-222222222222',
  workType: '44444444-4444-4444-8444-444444444444',
  actor: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  corr: '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b',
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
    createdBy: IDS.actor,
    version: 1,
    requestKey: null,
    jobBoardOpen: false,
    jobBoardOpenFrom: null,
    jobBoardOpenUntil: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

function reqWithUser(roles: string[], correlationId?: string): unknown {
  return {
    user: { sub: IDS.actor, email: 'pm@example.com', roles },
    headers: correlationId ? { 'x-correlation-id': correlationId } : {},
    ip: '127.0.0.1',
  };
}

function resMock(): { res: unknown; status: jest.Mock } {
  const status = jest.fn();
  return { res: { status }, status };
}

describe('WorkOrdersController (JOB-SRS-001)', () => {
  function setup() {
    const createWorkOrder = {
      execute: jest.fn(async () => ({ entity: makeEntity(), workTypeName: 'Đổ bê tông', idempotentReplay: false })),
    };
    const getWorkOrder = {
      execute: jest.fn(async () => ({ entity: makeEntity(), workTypeName: 'Đổ bê tông' })),
    };
    const searchWorkOrders = {
      execute: jest.fn(async () => ({
        entity: undefined,
        entities: [makeEntity()],
        total: 1,
        workTypeRefs: new Map(),
        projectRefs: new Map(),
      })),
    };
    const updateWorkOrder = {
      execute: jest.fn(async () => ({ entity: makeEntity(), workTypeName: 'Đổ bê tông', exceptionEdit: false, noOp: false })),
    };
    const openJobBoard = {
      execute: jest.fn(async () => ({ entity: makeEntity(), workTypeName: 'Đổ bê tông', hasActiveAssignment: false, alreadyOpen: false })),
    };
    const closeJobBoard = {
      execute: jest.fn(async () => ({ entity: makeEntity(), workTypeName: 'Đổ bê tông', hasActiveAssignment: false, alreadyClosed: false })),
    };
    const controller = new WorkOrdersController(createWorkOrder as never, getWorkOrder as never, searchWorkOrders as never, updateWorkOrder as never, openJobBoard as never, closeJobBoard as never);
    return { controller, createWorkOrder, getWorkOrder, searchWorkOrders, updateWorkOrder, openJobBoard, closeJobBoard };
  }

  it('POST create: forward actor server-derived + meta; 201 mặc định', async () => {
    const { controller, createWorkOrder } = setup();
    const { res, status } = resMock();
    const out = await controller.create(
      { projectId: IDS.project, workTypeId: IDS.workType, title: 'Đổ bê tông cột C1' } as never,
      reqWithUser(['PROJECT_MANAGER'], IDS.corr) as never,
      res as never,
    );
    expect(createWorkOrder.execute).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: IDS.project, actorUserId: IDS.actor, actorRoles: ['PROJECT_MANAGER'], correlationId: IDS.corr }),
    );
    expect(status).not.toHaveBeenCalled();
    expect(out).toMatchObject({ code: 'WO-2026-A1', status: 'DRAFT', workTypeName: 'Đổ bê tông' });
    expect('requestKey' in (out as Record<string, unknown>)).toBe(false);
  });

  it('POST replay: requestKey trùng → 200 + idempotentReplay', async () => {
    const { controller, createWorkOrder } = setup();
    createWorkOrder.execute.mockResolvedValueOnce({
      entity: makeEntity(),
      workTypeName: 'Đổ bê tông',
      idempotentReplay: true,
    });
    const { res, status } = resMock();
    const out = await controller.create(
      { projectId: IDS.project, workTypeId: IDS.workType, title: 'X', requestKey: IDS.corr } as never,
      reqWithUser(['PROJECT_MANAGER']) as never,
      res as never,
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(out).toMatchObject({ idempotentReplay: true });
  });

  it('POST: X-Correlation-Id sai → 400 (strict, chỉ POST)', async () => {
    const { controller, createWorkOrder } = setup();
    const { res } = resMock();
    await expect(
      controller.create(
        { projectId: IDS.project, workTypeId: IDS.workType, title: 'X' } as never,
        reqWithUser(['PROJECT_MANAGER'], 'not-a-uuid') as never,
        res as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createWorkOrder.execute).not.toHaveBeenCalled();
  });

  it('GET :id: forward actor + scope ở use case (member hay không do scope quyết)', async () => {
    const { controller, getWorkOrder } = setup();
    const out = await controller.getOne(IDS.wo, reqWithUser(['WORKER']) as never);
    expect(getWorkOrder.execute).toHaveBeenCalledWith(
      expect.objectContaining({ workOrderId: IDS.wo, actorUserId: IDS.actor, actorRoles: ['WORKER'] }),
    );
    expect(out).toMatchObject({ id: IDS.wo, status: 'DRAFT' });
  });

  it('GET list: forward actor + filter, trả { data, total, limit, offset } + no-store shape', async () => {
    const { controller, searchWorkOrders } = setup();
    const out = await controller.search(
      reqWithUser(['WORKER']) as never,
      IDS.project,
      'DRAFT',
      'be tong',
      '20',
      '0',
    );
    expect(searchWorkOrders.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: IDS.project,
        status: 'DRAFT',
        search: 'be tong',
        limit: 20,
        offset: 0,
        actorUserId: IDS.actor,
        actorRoles: ['WORKER'],
      }),
    );
    expect(out).toMatchObject({ total: 1, limit: 20, offset: 0 });
    expect((out as { data: unknown[] }).data).toHaveLength(1);
  });

  it('GET list: query mặc định (không filter) → limit 20 offset 0', async () => {
    const { controller, searchWorkOrders } = setup();
    const out = await controller.search(reqWithUser(['ADMIN']) as never, undefined, undefined, undefined, undefined, undefined);
    expect(searchWorkOrders.execute).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: undefined, status: undefined, actorRoles: ['ADMIN'] }),
    );
    expect(out).toMatchObject({ total: 1, limit: 20, offset: 0 });
  });

  it('GET list: status lạ / projectId sai UUID / limit-offset sai → 400 fieldErrors', async () => {
    const { controller, searchWorkOrders } = setup();
    const req = reqWithUser(['WORKER']) as never;
    await expect(controller.search(req, undefined, 'WRONG', undefined, undefined, undefined)).rejects.toMatchObject({
      response: expect.objectContaining({ fieldErrors: expect.objectContaining({ status: expect.any(Array) }) }),
    });
    await expect(controller.search(req, 'not-a-uuid', undefined, undefined, undefined, undefined)).rejects.toMatchObject({
      response: expect.objectContaining({ fieldErrors: expect.objectContaining({ projectId: expect.any(Array) }) }),
    });
    await expect(controller.search(req, undefined, undefined, undefined, '0', undefined)).rejects.toMatchObject({
      response: expect.objectContaining({ fieldErrors: expect.objectContaining({ limit: expect.any(Array) }) }),
    });
    await expect(controller.search(req, undefined, undefined, undefined, '101', undefined)).rejects.toMatchObject({
      response: expect.objectContaining({ fieldErrors: expect.objectContaining({ limit: expect.any(Array) }) }),
    });
    await expect(controller.search(req, undefined, undefined, undefined, undefined, '-1')).rejects.toMatchObject({
      response: expect.objectContaining({ fieldErrors: expect.objectContaining({ offset: expect.any(Array) }) }),
    });
    expect(searchWorkOrders.execute).not.toHaveBeenCalled();
  });

  it('PATCH :id: forward actor + patch fields + meta (scope/lock ở use case)', async () => {
    const { controller, updateWorkOrder } = setup();
    const out = await controller.update(
      IDS.wo,
      { description: 'Mô tả mới', expectedVersion: 1 } as never,
      reqWithUser(['PROJECT_MANAGER'], IDS.corr) as never,
    );
    expect(updateWorkOrder.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        workOrderId: IDS.wo,
        description: 'Mô tả mới',
        expectedVersion: 1,
        actorUserId: IDS.actor,
        actorRoles: ['PROJECT_MANAGER'],
        correlationId: IDS.corr,
      }),
    );
    expect(out).toMatchObject({ id: IDS.wo, status: 'DRAFT' });
  });

  it('PATCH: X-Correlation-Id sai → 400 (strict như POST)', async () => {
    const { controller, updateWorkOrder } = setup();
    await expect(
      controller.update(IDS.wo, { description: 'X' } as never, reqWithUser(['PROJECT_MANAGER'], 'not-a-uuid') as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updateWorkOrder.execute).not.toHaveBeenCalled();
  });

  it('POST :id/job-board/open: forward actor + window + meta; response có jobBoard', async () => {
    const { controller, openJobBoard } = setup();
    const out = await controller.openBoard(
      IDS.wo,
      { jobBoardOpenFrom: '2026-10-15T08:00:00.000Z', jobBoardOpenUntil: '2026-10-20T08:00:00.000Z', expectedVersion: 1 } as never,
      reqWithUser(['PROJECT_MANAGER'], IDS.corr) as never,
    );
    expect(openJobBoard.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        workOrderId: IDS.wo,
        jobBoardOpenFrom: '2026-10-15T08:00:00.000Z',
        jobBoardOpenUntil: '2026-10-20T08:00:00.000Z',
        expectedVersion: 1,
        actorUserId: IDS.actor,
        actorRoles: ['PROJECT_MANAGER'],
        correlationId: IDS.corr,
      }),
    );
    expect(out).toMatchObject({ id: IDS.wo, jobBoard: expect.objectContaining({ open: false }) });
    expect('alreadyOpen' in (out as Record<string, unknown>)).toBe(false);
  });

  it('POST :id/job-board/open replay → alreadyOpen: true', async () => {
    const { controller, openJobBoard } = setup();
    openJobBoard.execute.mockResolvedValueOnce({
      entity: makeEntity(),
      workTypeName: 'Đổ bê tông',
      hasActiveAssignment: false,
      alreadyOpen: true,
    });
    const out = await controller.openBoard(
      IDS.wo,
      { jobBoardOpenFrom: '2026-10-15T08:00:00.000Z' } as never,
      reqWithUser(['PROJECT_MANAGER'], IDS.corr) as never,
    );
    expect(out).toMatchObject({ alreadyOpen: true, jobBoard: expect.objectContaining({}) });
  });

  it('POST :id/job-board/open: X-Correlation-Id sai → 400', async () => {
    const { controller, openJobBoard } = setup();
    await expect(
      controller.openBoard(IDS.wo, {} as never, reqWithUser(['PROJECT_MANAGER'], 'not-a-uuid') as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(openJobBoard.execute).not.toHaveBeenCalled();
  });

  it('POST :id/job-board/close: forward actor + meta; replay → alreadyClosed', async () => {
    const { controller, closeJobBoard } = setup();
    const out = await controller.closeBoard(
      IDS.wo,
      { expectedVersion: 2, reason: 'Tạm dừng nhận việc' } as never,
      reqWithUser(['PROJECT_MANAGER'], IDS.corr) as never,
    );
    expect(closeJobBoard.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        workOrderId: IDS.wo,
        expectedVersion: 2,
        reason: 'Tạm dừng nhận việc',
        actorUserId: IDS.actor,
        correlationId: IDS.corr,
      }),
    );
    expect(out).toMatchObject({ id: IDS.wo, jobBoard: expect.objectContaining({ open: false }) });
    closeJobBoard.execute.mockResolvedValueOnce({
      entity: makeEntity(),
      workTypeName: 'Đổ bê tông',
      hasActiveAssignment: false,
      alreadyClosed: true,
    });
    const replay = await controller.closeBoard(IDS.wo, {} as never, reqWithUser(['PROJECT_MANAGER']) as never);
    expect(replay).toMatchObject({ alreadyClosed: true });
  });

  it('POST :id/job-board/close: X-Correlation-Id sai → 400', async () => {
    const { controller, closeJobBoard } = setup();
    await expect(
      controller.closeBoard(IDS.wo, {} as never, reqWithUser(['PROJECT_MANAGER'], 'nope') as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(closeJobBoard.execute).not.toHaveBeenCalled();
  });
});
