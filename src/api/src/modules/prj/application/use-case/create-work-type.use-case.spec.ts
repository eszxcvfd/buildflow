import { ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { CreateWorkTypeUseCase } from './create-work-type.use-case';
import { WorkTypeEntity } from '../../domain/entity/work-type.entity';
import { WorkTypeRepositoryPort } from '../../domain/repository/work-type-repository.port';

function makeEntity(code = 'CONCRETE'): WorkTypeEntity {
  return new WorkTypeEntity({
    id: '11111111-1111-4111-8111-111111111111',
    code,
    name: 'Đổ bê tông',
    description: null,
    group: null,
    requiredTradeId: null,
    requiredFields: [],
    configVersion: 1,
    defaultDurationMinutes: null,
    defaultPriority: 'NORMAL',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeRepo(overrides?: Partial<WorkTypeRepositoryPort>): WorkTypeRepositoryPort & { store: WorkTypeEntity[] } {
  const store: WorkTypeEntity[] = [];
  const repo = {
    findById: jest.fn(async () => null),
    findByCode: jest.fn(async () => null),
    search: jest.fn(async () => ({ entities: [], total: 0 })),
    findAllActive: jest.fn(async () => []),
    findActiveTradeById: jest.fn(async () => null),
    countActiveWorkOrders: jest.fn(async () => 0),
    create: jest.fn(async (e: WorkTypeEntity) => { store.push(e); }),
    createWithClient: jest.fn(async (_c: unknown, e: WorkTypeEntity) => { store.push(e); }),
    save: jest.fn(async () => {}),
    saveWithClient: jest.fn(async () => {}),
    ...overrides,
  } as unknown as WorkTypeRepositoryPort & { store: WorkTypeEntity[] };
  repo.store = store;
  return repo;
}

const baseInput = {
  code: 'CONCRETE',
  name: 'Đổ bê tông',
  actorUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

describe('CreateWorkTypeUseCase (PRJ-SRS-004)', () => {
  it('happy path → entity version 1 + audit PRJ_WORK_TYPE_CREATED', async () => {
    const repo = makeRepo();
    const audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) };
    const tx = { withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn({}) };
    const uc = new CreateWorkTypeUseCase(repo, audit as never, tx as never);
    const { entity } = await uc.execute({ ...baseInput });
    expect(entity.configVersion).toBe(1);
    expect(repo.store).toHaveLength(1);
    expect(audit.logWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'PRJ_WORK_TYPE_CREATED', entityType: 'WORK_TYPE', beforeData: null }),
    );
  });

  it('trùng code (CI) → 409 WORK_TYPE_CODE_DUPLICATE', async () => {
    const repo = makeRepo({ findByCode: jest.fn(async () => makeEntity()) });
    const uc = new CreateWorkTypeUseCase(repo, { logWithClient: jest.fn() } as never, { withTransaction: jest.fn() } as never);
    await expect(uc.execute({ ...baseInput, code: 'concrete' })).rejects.toMatchObject({
      status: 409,
    });
    try {
      await uc.execute({ ...baseInput });
      fail('expected 409');
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictException);
      expect((e as ConflictException).getResponse()).toMatchObject({ code: 'WORK_TYPE_CODE_DUPLICATE' });
    }
  });

  it('required_fields sai shape → 400 fieldErrors', async () => {
    const repo = makeRepo();
    const uc = new CreateWorkTypeUseCase(repo, { logWithClient: jest.fn() } as never, { withTransaction: jest.fn() } as never);
    await expect(uc.execute({ ...baseInput, requiredFields: [{ key: 'k' }] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('trade không tồn tại hoặc inactive → 400 fieldErrors requiredTradeId', async () => {
    const tradeId = '22222222-2222-4222-8222-222222222222';
    const repoMissing = makeRepo({ findActiveTradeById: jest.fn(async () => null) });
    const ucMissing = new CreateWorkTypeUseCase(repoMissing, { logWithClient: jest.fn() } as never, { withTransaction: jest.fn() } as never);
    await expect(ucMissing.execute({ ...baseInput, requiredTradeId: tradeId })).rejects.toMatchObject({
      response: expect.objectContaining({ fieldErrors: expect.objectContaining({ requiredTradeId: expect.anything() }) }),
    });
    const repoInactive = makeRepo({ findActiveTradeById: jest.fn(async () => ({ id: tradeId, isActive: false })) });
    const ucInactive = new CreateWorkTypeUseCase(repoInactive, { logWithClient: jest.fn() } as never, { withTransaction: jest.fn() } as never);
    await expect(ucInactive.execute({ ...baseInput, requiredTradeId: tradeId })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('trade active → tạo kèm requiredTradeId', async () => {
    const tradeId = '22222222-2222-4222-8222-222222222222';
    const repo = makeRepo({ findActiveTradeById: jest.fn(async () => ({ id: tradeId, isActive: true })) });
    const audit = { logWithClient: jest.fn(async () => {}) };
    const tx = { withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn({}) };
    const uc = new CreateWorkTypeUseCase(repo, audit as never, tx as never);
    const { entity } = await uc.execute({ ...baseInput, requiredTradeId: tradeId });
    expect(entity.requiredTradeId).toBe(tradeId);
  });

  it('race 23505 ux_work_types_code → 409; constraint khác rethrow', async () => {
    const err = Object.assign(new Error('dup'), { code: '23505', constraint: 'ux_work_types_code' });
    const repo = makeRepo({ createWithClient: jest.fn(async () => { throw err; }) });
    const audit = { logWithClient: jest.fn(async () => {}) };
    const tx = { withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn({}) };
    const uc = new CreateWorkTypeUseCase(repo, audit as never, tx as never);
    await expect(uc.execute({ ...baseInput })).rejects.toBeInstanceOf(ConflictException);
  });

  it('audit thất bại → 500 rollback (catch-all); thiếu logWithClient → 500', async () => {
    const repo = makeRepo();
    const audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) };
    const tx = { withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn({}) };
    audit.logWithClient.mockRejectedValue(new Error('db down'));
    const uc = new CreateWorkTypeUseCase(repo, audit as never, tx as never);
    const err = await uc.execute({ ...baseInput }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InternalServerErrorException);
    // mutation đã thử trong tx nhưng 500 thoát ra khỏi callback → tx thật ROLLBACK
    expect(repo.createWithClient).toHaveBeenCalled();
    const noTxAudit = new CreateWorkTypeUseCase(
      makeRepo(), { log: jest.fn() } as never, tx as never,
    );
    const err2 = await noTxAudit.execute({ ...baseInput }).catch((e: unknown) => e);
    expect(err2).toBeInstanceOf(InternalServerErrorException);
  });
});
