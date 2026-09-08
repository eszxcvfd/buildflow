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
    plannedHeadcount: null,
    createdBy: IDS.actor,
    version: 1,
    requestKey: null,
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
    const controller = new WorkOrdersController(createWorkOrder as never, getWorkOrder as never);
    return { controller, createWorkOrder, getWorkOrder };
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
});
