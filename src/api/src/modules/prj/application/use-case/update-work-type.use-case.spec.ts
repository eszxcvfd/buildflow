import { ConflictException, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { UpdateWorkTypeUseCase } from './update-work-type.use-case';
import { WorkTypeEntity } from '../../domain/entity/work-type.entity';
import { WorkTypeRepositoryPort } from '../../domain/repository/work-type-repository.port';

const WT_ID = '11111111-1111-4111-8111-111111111111';
const TRADE_ID = '22222222-2222-4222-8222-222222222222';

function makeEntity(overrides?: Partial<ConstructorParameters<typeof WorkTypeEntity>[0]>): WorkTypeEntity {
  return new WorkTypeEntity({
    id: WT_ID,
    code: 'CONCRETE',
    name: 'Đổ bê tông',
    description: null,
    group: null,
    requiredTradeId: null,
    requiredFields: [],
    configVersion: 3,
    defaultDurationMinutes: null,
    defaultPriority: 'NORMAL',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

function setup(current?: WorkTypeEntity, usage = 0) {
  const store = current ?? makeEntity();
  const repo = {
    findById: jest.fn(async () => store),
    findByCode: jest.fn(async () => null),
    search: jest.fn(async () => ({ entities: [], total: 0 })),
    findAllActive: jest.fn(async () => []),
    findActiveTradeById: jest.fn(async () => ({ id: TRADE_ID, isActive: true })),
    countActiveWorkOrders: jest.fn(async () => usage),
    create: jest.fn(async () => {}),
    createWithClient: jest.fn(async () => {}),
    save: jest.fn(async () => {}),
    saveWithClient: jest.fn(async () => {}),
  } as unknown as WorkTypeRepositoryPort;
  const audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) };
  const tx = { withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn({}) };
  const uc = new UpdateWorkTypeUseCase(repo, audit as never, tx as never);
  return { repo, audit, tx, uc, store };
}

const base = { workTypeId: WT_ID, actorUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };

describe('UpdateWorkTypeUseCase (PRJ-SRS-004)', () => {
  it('expectedConfigVersion mismatch → 409 WORK_TYPE_CONFIG_CONFLICT + fieldErrors', async () => {
    const { uc } = setup();
    try {
      await uc.execute({ ...base, name: 'Mới', expectedConfigVersion: 2 });
      fail('expected 409');
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictException);
      expect((e as ConflictException).getResponse()).toMatchObject({
        code: 'WORK_TYPE_CONFIG_CONFLICT',
        fieldErrors: expect.objectContaining({ expectedConfigVersion: expect.anything() }),
      });
    }
  });

  it('đổi name đúng version → version +1, audit PRJ_WORK_TYPE_UPDATED', async () => {
    const { uc, audit, store } = setup();
    const { entity, versionChanged, warning } = await uc.execute({
      ...base,
      name: 'Tên mới',
      expectedConfigVersion: 3,
    });
    expect(versionChanged).toBe(true);
    expect(entity.configVersion).toBe(4);
    expect(warning).toBeUndefined();
    expect(store.configVersion).toBe(4);
    expect(audit.logWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'PRJ_WORK_TYPE_UPDATED', entityType: 'WORK_TYPE' }),
    );
  });

  it('expectedConfigVersion được forward xuống SQL guard (saveWithClient opts)', async () => {
    const { uc, repo } = setup();
    await uc.execute({ ...base, name: 'Tên mới', expectedConfigVersion: 3 });
    expect(repo.saveWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expectedConfigVersion: 3 },
    );
  });

  it('đồng thời cùng version: SQL guard rowcount 0 → 409 WORK_TYPE_CONFIG_CONFLICT lan truyền', async () => {
    const { uc, repo } = setup();
    (repo.saveWithClient as jest.Mock).mockRejectedValueOnce(
      new ConflictException({
        statusCode: 409,
        message: 'Cấu hình đã bị thay đổi bởi người dùng khác (hiện tại version 4); vui lòng tải lại và thử lại',
        code: 'WORK_TYPE_CONFIG_CONFLICT',
        fieldErrors: { expectedConfigVersion: ['Version cấu hình đã thay đổi (hiện tại: 4)'] },
      }),
    );
    try {
      // PATCH thứ hai: pass pre-check (cùng đọc v3) nhưng thua guard ở commit.
      await uc.execute({ ...base, name: 'Ghi đè đồng thời', expectedConfigVersion: 3 });
      fail('expected 409');
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictException);
      expect((e as ConflictException).getResponse()).toMatchObject({
        code: 'WORK_TYPE_CONFIG_CONFLICT',
      });
    }
  });

  it('config đổi + WO đang dùng → warning phạm vi áp dụng (WO=0 hiện tại không warning)', async () => {
    const { uc } = setup(makeEntity(), 5);
    const { warning, versionChanged } = await uc.execute({
      ...base,
      requiredFields: [{ key: 'photo', label: 'Ảnh', type: 'PHOTO' }],
      expectedConfigVersion: 3,
    });
    expect(versionChanged).toBe(true);
    expect(warning).toContain('Work Order');
  });

  it('không thay đổi hiệu lực → no-op, không audit', async () => {
    const { uc, audit } = setup();
    const { versionChanged } = await uc.execute({ ...base, name: 'Đổ bê tông', expectedConfigVersion: 3 });
    expect(versionChanged).toBe(false);
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('trade inactive khi sửa → 400 fieldErrors requiredTradeId', async () => {
    const store = makeEntity();
    const repo = {
      findById: jest.fn(async () => store),
      findByCode: jest.fn(async () => null),
      search: jest.fn(async () => ({ entities: [], total: 0 })),
      findAllActive: jest.fn(async () => []),
      findActiveTradeById: jest.fn(async () => ({ id: TRADE_ID, isActive: false })),
      countActiveWorkOrders: jest.fn(async () => 0),
      create: jest.fn(async () => {}),
      save: jest.fn(async () => {}),
      saveWithClient: jest.fn(async () => {}),
    } as unknown as WorkTypeRepositoryPort;
    const uc = new UpdateWorkTypeUseCase(
      repo,
      { logWithClient: jest.fn() } as never,
      { withTransaction: jest.fn() } as never,
    );
    await expect(uc.execute({ ...base, requiredTradeId: TRADE_ID })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404 khi không tồn tại', async () => {
    const repo = {
      findById: jest.fn(async () => null),
    } as unknown as WorkTypeRepositoryPort;
    const uc = new UpdateWorkTypeUseCase(
      repo,
      { logWithClient: jest.fn() } as never,
      { withTransaction: jest.fn() } as never,
    );
    await expect(uc.execute({ ...base, name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('audit thất bại → 500 rollback (catch-all); thiếu logWithClient → 500', async () => {
    const { repo, audit, uc } = setup();
    audit.logWithClient.mockRejectedValue(new Error('db down'));
    const err = await uc
      .execute({ ...base, name: 'Tên mới', expectedConfigVersion: 3 })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InternalServerErrorException);
    // mutation đã thử trong tx nhưng 500 thoát ra khỏi callback → tx thật ROLLBACK
    expect(repo.saveWithClient).toHaveBeenCalled();
    const fresh = setup();
    const noTxAudit = new UpdateWorkTypeUseCase(
      fresh.repo, { log: jest.fn() } as never, fresh.tx as never,
    );
    const err2 = await noTxAudit
      .execute({ ...base, name: 'Tên mới', expectedConfigVersion: 3 })
      .catch((e: unknown) => e);
    expect(err2).toBeInstanceOf(InternalServerErrorException);
  });
});
