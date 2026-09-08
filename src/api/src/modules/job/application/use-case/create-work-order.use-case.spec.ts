import { BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { CreateWorkOrderUseCase, CreateWorkOrderInput } from './create-work-order.use-case';
import { WorkOrderEntity } from '../../domain/entity/work-order.entity';
import { WorkOrderRepositoryPort } from '../../domain/repository/work-order-repository.port';

const IDS = {
  project: '22222222-2222-4222-8222-222222222222',
  otherProject: '99999999-9999-4999-8999-999999999999',
  area: '33333333-3333-4333-8333-333333333333',
  workType: '44444444-4444-4444-8444-444444444444',
  inactiveWorkType: '66666666-6666-4666-8666-666666666666',
  trade: '55555555-5555-4555-8555-555555555555',
  inactiveTrade: '77777777-7777-4777-8777-777777777777',
  actor: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  key: '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b',
};

function makeEntity(code = 'WO-2026-A1'): WorkOrderEntity {
  return new WorkOrderEntity({
    id: '11111111-1111-4111-8111-111111111111',
    code,
    projectId: IDS.project,
    areaId: IDS.area,
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
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeRepo(overrides?: Partial<WorkOrderRepositoryPort>): WorkOrderRepositoryPort {
  return {
    findById: jest.fn(async () => null),
    findByCode: jest.fn(async () => null),
    findByRequestKey: jest.fn(async () => null),
    findActiveWorkTypeById: jest.fn(async (id: string) =>
      id === IDS.inactiveWorkType ? { id, isActive: false } : { id, isActive: true },
    ),
    findActiveAreaById: jest.fn(async (id: string) => ({ id, projectId: IDS.project, isActive: true })),
    findActiveTradeById: jest.fn(async (id: string) =>
      id === IDS.inactiveTrade ? { id, isActive: false } : { id, isActive: true },
    ),
    findProjectStatusById: jest.fn(async (id: string) => ({ id, status: 'ACTIVE' })),
    findWorkTypeNameById: jest.fn(async () => 'Đổ bê tông'),
    create: jest.fn(async () => {}),
    createWithClient: jest.fn(async () => {}),
    ...overrides,
  } as unknown as WorkOrderRepositoryPort;
}

function makeScope(order: string[] = []) {
  return {
    assertProjectWriteScope: jest.fn(async () => {
      order.push('scope');
      return { isAdminBypass: false };
    }),
    assertProjectMemberScope: jest.fn(async () => ({ isAdminBypass: false })),
  };
}

const baseInput: CreateWorkOrderInput = {
  projectId: IDS.project,
  workTypeId: IDS.workType,
  title: 'Đổ bê tông cột C1',
  actorUserId: IDS.actor,
  actorRoles: ['PROJECT_MANAGER'],
};

function setup(repoOverrides?: Partial<WorkOrderRepositoryPort>, order: string[] = []) {
  const repo = makeRepo(repoOverrides);
  // Ghi nhận thứ tự: mọi repo read phải chạy SAU scope (J1 scope-first).
  for (const key of ['findByCode', 'findByRequestKey', 'findActiveWorkTypeById', 'findActiveAreaById', 'findActiveTradeById', 'findProjectStatusById'] as const) {
    const original = repo[key] as jest.Mock;
    const inner = original.getMockImplementation();
    original.mockImplementation(async (...args: unknown[]) => {
      order.push(String(key));
      return inner?.(...args);
    });
  }
  const scope = makeScope(order);
  const audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) };
  const tx = { withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn({}) };
  const uc = new CreateWorkOrderUseCase(repo, audit as never, tx as never, scope as never);
  return { uc, repo, scope, audit, tx, order };
}

describe('CreateWorkOrderUseCase (JOB-SRS-001)', () => {
  it('happy path → DRAFT + code client-supplied + audit JOB_WORK_ORDER_CREATED', async () => {
    const { uc, audit } = setup();
    const { entity, workTypeName, idempotentReplay } = await uc.execute({ ...baseInput, code: 'WO-2026-A1' });
    expect(entity.status).toBe('DRAFT');
    expect(entity.code).toBe('WO-2026-A1');
    expect(entity.createdBy).toBe(IDS.actor);
    expect(workTypeName).toBe('Đổ bê tông');
    expect(idempotentReplay).toBe(false);
    expect(audit.logWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'JOB_WORK_ORDER_CREATED',
        entityType: 'WORK_ORDER',
        beforeData: null,
        result: 'SUCCESS',
      }),
    );
    const payload = (audit.logWithClient as jest.Mock).mock.calls[0][1];
    expect(payload.afterData).toMatchObject({ status: 'DRAFT', createdBy: IDS.actor });
  });

  it('thiếu code → server sinh WO-...; thiếu schedule/area/trade vẫn DRAFT', async () => {
    const { uc } = setup();
    const { entity } = await uc.execute({ ...baseInput });
    expect(entity.code).toMatch(/^WO-[A-Z0-9]+$/);
    expect(entity.isDraft()).toBe(true);
  });

  it('J1 scope-first: không repo read nào chạy trước scope (non-admin)', async () => {
    const order: string[] = [];
    const { uc } = setup(undefined, order);
    await uc.execute({ ...baseInput, areaId: IDS.area, requiredTradeId: IDS.trade, requestKey: IDS.key, code: 'WO-X1' });
    expect(order[0]).toBe('scope');
    expect(order).toContain('findActiveWorkTypeById');
  });

  it('workType không tồn tại hoặc INACTIVE → 400 fieldErrors workTypeId', async () => {
    const { uc } = setup({ findActiveWorkTypeById: jest.fn(async () => null) });
    await expect(uc.execute({ ...baseInput })).rejects.toMatchObject({
      response: expect.objectContaining({ fieldErrors: expect.objectContaining({ workTypeId: expect.anything() }) }),
    });
    const { uc: ucInactive } = setup();
    await expect(ucInactive.execute({ ...baseInput, workTypeId: IDS.inactiveWorkType })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('area khác project / INACTIVE / không tồn tại → 400 fieldErrors areaId', async () => {
    const { uc } = setup({
      findActiveAreaById: jest.fn(async (id: string) => ({ id, projectId: IDS.otherProject, isActive: true })),
    });
    await expect(uc.execute({ ...baseInput, areaId: IDS.area })).rejects.toMatchObject({
      response: expect.objectContaining({ fieldErrors: expect.objectContaining({ areaId: expect.anything() }) }),
    });
    const { uc: ucInactive } = setup({
      findActiveAreaById: jest.fn(async (id: string) => ({ id, projectId: IDS.project, isActive: false })),
    });
    await expect(ucInactive.execute({ ...baseInput, areaId: IDS.area })).rejects.toBeInstanceOf(BadRequestException);
    const { uc: ucMissing } = setup({ findActiveAreaById: jest.fn(async () => null) });
    await expect(ucMissing.execute({ ...baseInput, areaId: IDS.area })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('trade INACTIVE / không tồn tại → 400 fieldErrors requiredTradeId', async () => {
    const { uc } = setup();
    await expect(uc.execute({ ...baseInput, requiredTradeId: IDS.inactiveTrade })).rejects.toMatchObject({
      response: expect.objectContaining({ fieldErrors: expect.objectContaining({ requiredTradeId: expect.anything() }) }),
    });
    const { uc: ucMissing } = setup({ findActiveTradeById: jest.fn(async () => null) });
    await expect(ucMissing.execute({ ...baseInput, requiredTradeId: IDS.trade })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('plannedEndAt <= plannedStartAt → 400 fieldErrors plannedEndAt', async () => {
    const { uc } = setup();
    await expect(
      uc.execute({
        ...baseInput,
        plannedStartAt: '2026-10-02T08:00:00.000Z',
        plannedEndAt: '2026-10-01T08:00:00.000Z',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ fieldErrors: expect.objectContaining({ plannedEndAt: expect.anything() }) }),
    });
  });

  it('trùng code (CI pre-check) → 409 WORK_ORDER_CODE_DUPLICATE', async () => {
    const { uc } = setup({ findByCode: jest.fn(async () => makeEntity()) });
    try {
      await uc.execute({ ...baseInput, code: 'wo-2026-a1' });
      fail('expected 409');
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictException);
      expect((e as ConflictException).getResponse()).toMatchObject({ code: 'WORK_ORDER_CODE_DUPLICATE' });
    }
  });

  it('race 23505 ux_work_orders_code → 409; bare 23505 rethrow', async () => {
    const race409 = setup({
      createWithClient: jest.fn(async () => {
        throw { code: '23505', constraint: 'ux_work_orders_code' };
      }),
    });
    await expect(race409.uc.execute({ ...baseInput, code: 'WO-2026-A1' })).rejects.toMatchObject({ status: 409 });

    const raceBare = setup({
      createWithClient: jest.fn(async () => {
        throw { code: '23505', constraint: 'some_other_constraint' };
      }),
    });
    await expect(raceBare.uc.execute({ ...baseInput, code: 'WO-2026-A1' })).rejects.toMatchObject({
      code: '23505',
    });
  });

  it('G2 race 23505 ux_work_orders_request_key → 200 replay idempotentReplay, không audit', async () => {
    const existing = makeEntity('WO-OLD-9');
    const repo = makeRepo({
      findByRequestKey: jest.fn(async () => existing),
      createWithClient: jest.fn(async () => {
        throw { code: '23505', constraint: 'ux_work_orders_request_key' };
      }),
    });
    const scope = makeScope();
    const audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) };
    const tx = { withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn({}) };
    const uc = new CreateWorkOrderUseCase(repo, audit as never, tx as never, scope as never);
    const out = await uc.execute({ ...baseInput, requestKey: IDS.key });
    expect(out.entity.code).toBe('WO-OLD-9');
    expect(out.idempotentReplay).toBe(true);
    expect(out.workTypeName).toBe('Đổ bê tông');
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('G2 race request_key nhưng row không còn → rethrow lỗi gốc', async () => {
    const { uc } = setup({
      findByRequestKey: jest.fn(async () => null),
      createWithClient: jest.fn(async () => {
        throw { code: '23505', constraint: 'ux_work_orders_request_key' };
      }),
    });
    await expect(uc.execute({ ...baseInput, requestKey: IDS.key })).rejects.toMatchObject({
      code: '23505',
    });
  });

  it('G3 project PAUSED/DRAFT/COMPLETED/CLOSED → 400 WORK_ORDER_PROJECT_NOT_ACTIVE + fieldErrors projectId', async () => {
    for (const status of ['PAUSED', 'DRAFT', 'COMPLETED', 'CLOSED']) {
      const withTx = { withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({})) };
      const repo = makeRepo({ findProjectStatusById: jest.fn(async (id: string) => ({ id, status })) });
      const scope = makeScope();
      const audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) };
      const uc = new CreateWorkOrderUseCase(repo, audit as never, withTx as never, scope as never);
      try {
        await uc.execute({ ...baseInput });
        fail(`expected 400 for project status ${status}`);
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect((e as BadRequestException).getResponse()).toMatchObject({
          code: 'WORK_ORDER_PROJECT_NOT_ACTIVE',
          fieldErrors: { projectId: expect.anything() },
        });
      }
      expect(withTx.withTransaction).not.toHaveBeenCalled();
    }
  });

  it('G3 project missing sau scope → 404 (defensive)', async () => {
    const { uc } = setup({ findProjectStatusById: jest.fn(async () => null) });
    await expect(uc.execute({ ...baseInput })).rejects.toMatchObject({ status: 404 });
  });

  it('G3 project status read chạy sau scope (scope-first J1)', async () => {
    const order: string[] = [];
    const { uc } = setup(undefined, order);
    await uc.execute({ ...baseInput });
    expect(order[0]).toBe('scope');
    expect(order).toContain('findProjectStatusById');
    expect(order.indexOf('scope')).toBeLessThan(order.indexOf('findProjectStatusById'));
  });

  it('requestKey trùng → 200 existing + idempotentReplay, KHÔNG audit, KHÔNG tx', async () => {
    const existing = makeEntity('WO-OLD-1');
    const withTx = { withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({})) };
    const repo = makeRepo({ findByRequestKey: jest.fn(async () => existing) });
    const scope = makeScope();
    const audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) };
    const uc = new CreateWorkOrderUseCase(repo, audit as never, withTx as never, scope as never);
    const out = await uc.execute({ ...baseInput, requestKey: IDS.key, title: 'Tiêu đề khác' });
    expect(out.entity.code).toBe('WO-OLD-1');
    expect(out.idempotentReplay).toBe(true);
    expect(withTx.withTransaction).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('audit fail → 500 rollback (không swallow)', async () => {
    const { uc } = setup();
    (uc as unknown as { audit: { logWithClient: jest.Mock } }).audit.logWithClient.mockRejectedValueOnce(
      new Error('audit down'),
    );
    await expect(uc.execute({ ...baseInput, code: 'WO-2026-A1' })).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
