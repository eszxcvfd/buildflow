import { CreateWorkOrderTemplateUseCase } from './create-work-order-template.use-case';
import { WorkOrderTemplateEntity } from '../../domain/entity/work-order-template.entity';
import { WorkOrderTemplateRepositoryPort } from '../../domain/repository/work-order-template-repository.port';

const ACTIVE_TRADE = { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', code: 'MASON', isActive: true };
const ACTIVE_WORK_TYPE = { id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', isActive: true };

function makeRepo(overrides?: Record<string, jest.Mock>): WorkOrderTemplateRepositoryPort & { store: WorkOrderTemplateEntity[] } {
  const store: WorkOrderTemplateEntity[] = [];
  const repo = {
    findById: jest.fn(async () => null),
    findByCode: jest.fn(async () => null),
    search: jest.fn(async () => ({ entities: [], total: 0 })),
    findAllActive: jest.fn(async () => []),
    findActiveTradeById: jest.fn(async () => null),
    findActiveTradeByCode: jest.fn(async () => null),
    findActiveWorkTypeById: jest.fn(async () => null),
    findChecklistTemplateSnapshot: jest.fn(async () => null),
    findWorkTypeRefs: jest.fn(async () => new Map()),
    create: jest.fn(async (e: WorkOrderTemplateEntity) => { store.push(e); }),
    createWithClient: jest.fn(async (_c: unknown, e: WorkOrderTemplateEntity) => { store.push(e); }),
    save: jest.fn(async () => {}),
    saveWithClient: jest.fn(async () => {}),
    ...overrides,
  } as unknown as WorkOrderTemplateRepositoryPort & { store: WorkOrderTemplateEntity[] };
  repo.store = store;
  return repo;
}

const baseInput = {
  code: 'SLAB-POUR',
  name: 'Đổ sàn',
  actorUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

describe('CreateWorkOrderTemplateUseCase (PRJ-SRS-008)', () => {
  it('happy path → DRAFT version 1 + audit PRJ_WO_TEMPLATE_CREATED', async () => {
    const repo = makeRepo();
    const audit = { logWithClient: jest.fn(async () => {}) };
    const tx = { withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn({}) };
    const uc = new CreateWorkOrderTemplateUseCase(repo, audit as never, tx as never);
    const { entity } = await uc.execute({ ...baseInput });
    expect(entity.status).toBe('DRAFT');
    expect(entity.version).toBe(1);
    expect(repo.store).toHaveLength(1);
    expect(audit.logWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'PRJ_WO_TEMPLATE_CREATED', entityType: 'WORK_ORDER_TEMPLATE', beforeData: null }),
    );
  });

  it('trùng code (CI) → 409 WORK_ORDER_TEMPLATE_CODE_DUPLICATE', async () => {
    const existing = new WorkOrderTemplateEntity({
      id: '11111111-1111-4111-8111-111111111111',
      code: 'SLAB-POUR',
      name: 'Khác',
      description: null,
      workTypeId: null,
      requiredTradeId: null,
      defaultDurationMinutes: null,
      defaultPriority: 'NORMAL',
      requiredSkills: [],
      checklistSnapshot: [],
      sourceChecklistTemplateId: null,
      status: 'DRAFT',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const repo = makeRepo({ findByCode: jest.fn(async () => existing) });
    const uc = new CreateWorkOrderTemplateUseCase(repo, { logWithClient: jest.fn() } as never, { withTransaction: jest.fn() } as never);
    await expect(uc.execute({ ...baseInput, code: 'slab-pour' })).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({ code: 'WORK_ORDER_TEMPLATE_CODE_DUPLICATE' }),
    });
  });

  it('work_type inactive → 400 fieldErrors {workTypeId}', async () => {
    const repo = makeRepo({
      findActiveWorkTypeById: jest.fn(async () => ({ id: 'x', isActive: false })),
    });
    const uc = new CreateWorkOrderTemplateUseCase(repo, { logWithClient: jest.fn() } as never, { withTransaction: jest.fn() } as never);
    await expect(
      uc.execute({ ...baseInput, workTypeId: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('required_trade inactive → 400 fieldErrors {requiredTradeId}', async () => {
    const repo = makeRepo({
      findActiveTradeById: jest.fn(async () => ({ ...ACTIVE_TRADE, isActive: false })),
    });
    const uc = new CreateWorkOrderTemplateUseCase(repo, { logWithClient: jest.fn() } as never, { withTransaction: jest.fn() } as never);
    await expect(
      uc.execute({ ...baseInput, requiredTradeId: ACTIVE_TRADE.id }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('skill code không tồn tại → 400 fieldErrors {requiredSkills}', async () => {
    const repo = makeRepo({ findActiveTradeByCode: jest.fn(async () => null) });
    const uc = new CreateWorkOrderTemplateUseCase(repo, { logWithClient: jest.fn() } as never, { withTransaction: jest.fn() } as never);
    await expect(
      uc.execute({ ...baseInput, requiredSkills: [{ code: 'GHOST', label: 'Ma' }] }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('source checklist tồn tại + omit snapshot → snapshot-copy items', async () => {
    const items = [{ title: 'Kiểm tra cốp pha', answerType: 'YES_NO', isRequired: true, isBlocking: true, sequenceNo: 1 }] as never[];
    const repo = makeRepo({
      findChecklistTemplateSnapshot: jest.fn(async () => ({ id: 's1', items })),
    });
    const audit = { logWithClient: jest.fn(async () => {}) };
    const tx = { withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn({}) };
    const uc = new CreateWorkOrderTemplateUseCase(repo, audit as never, tx as never);
    const { entity } = await uc.execute({
      ...baseInput,
      sourceChecklistTemplateId: '22222222-2222-4222-8222-222222222222',
    });
    expect(entity.checklistSnapshot).toHaveLength(1);
    expect(entity.sourceChecklistTemplateId).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('source checklist không tồn tại → 400 fieldErrors {sourceChecklistTemplateId}', async () => {
    const repo = makeRepo({ findChecklistTemplateSnapshot: jest.fn(async () => null) });
    const uc = new CreateWorkOrderTemplateUseCase(repo, { logWithClient: jest.fn() } as never, { withTransaction: jest.fn() } as never);
    await expect(
      uc.execute({ ...baseInput, sourceChecklistTemplateId: '22222222-2222-4222-8222-222222222222' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('work_type + trade active → persist liên kết', async () => {
    const repo = makeRepo({
      findActiveWorkTypeById: jest.fn(async () => ACTIVE_WORK_TYPE),
      findActiveTradeById: jest.fn(async () => ACTIVE_TRADE),
      findActiveTradeByCode: jest.fn(async () => ACTIVE_TRADE),
    });
    const audit = { logWithClient: jest.fn(async () => {}) };
    const tx = { withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn({}) };
    const uc = new CreateWorkOrderTemplateUseCase(repo, audit as never, tx as never);
    const { entity } = await uc.execute({
      ...baseInput,
      workTypeId: ACTIVE_WORK_TYPE.id,
      requiredTradeId: ACTIVE_TRADE.id,
      requiredSkills: [{ code: 'MASON', label: 'Thợ nề' }],
    });
    expect(entity.workTypeId).toBe(ACTIVE_WORK_TYPE.id);
    expect(entity.requiredTradeId).toBe(ACTIVE_TRADE.id);
  });
});
