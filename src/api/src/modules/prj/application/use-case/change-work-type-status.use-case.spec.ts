import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ChangeWorkTypeStatusUseCase } from './change-work-type-status.use-case';
import { WorkTypeEntity } from '../../domain/entity/work-type.entity';
import { WorkTypeRepositoryPort } from '../../domain/repository/work-type-repository.port';

const WT_ID = '11111111-1111-4111-8111-111111111111';

function makeEntity(isActive: boolean): WorkTypeEntity {
  return new WorkTypeEntity({
    id: WT_ID,
    code: 'CONCRETE',
    name: 'Đổ bê tông',
    description: null,
    group: null,
    requiredTradeId: null,
    requiredFields: [],
    configVersion: 1,
    defaultDurationMinutes: null,
    defaultPriority: 'NORMAL',
    isActive,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function setup(isActive: boolean, usage = 0) {
  const store = makeEntity(isActive);
  const repo = {
    findById: jest.fn(async () => store),
    findByCode: jest.fn(async () => null),
    search: jest.fn(async () => ({ entities: [], total: 0 })),
    findAllActive: jest.fn(async () => []),
    findActiveTradeById: jest.fn(async () => null),
    countActiveWorkOrders: jest.fn(async () => usage),
    create: jest.fn(async () => {}),
    save: jest.fn(async () => {}),
    saveWithClient: jest.fn(async () => {}),
  } as unknown as WorkTypeRepositoryPort;
  const audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) };
  const tx = { withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn({}) };
  const uc = new ChangeWorkTypeStatusUseCase(repo, audit as never, tx as never);
  return { uc, audit, store };
}

const base = { workTypeId: WT_ID, actorUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };

describe('ChangeWorkTypeStatusUseCase (PRJ-SRS-004/007)', () => {
  it('DEACTIVATE → INACTIVE + audit PRJ_WORK_TYPE_STATUS_CHANGED', async () => {
    const { uc, audit, store } = setup(true);
    const { entity, alreadyInState, warning } = await uc.execute({ ...base, action: 'DEACTIVATE' });
    expect(entity.status).toBe('INACTIVE');
    expect(alreadyInState).toBe(false);
    expect(warning).toBeUndefined();
    expect(store.status).toBe('INACTIVE');
    expect(audit.logWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'PRJ_WORK_TYPE_STATUS_CHANGED', entityType: 'WORK_TYPE' }),
    );
  });

  it('deactivate khi WO đang chạy → vẫn cho phép + warning', async () => {
    const { uc } = setup(true, 4);
    const { alreadyInState, warning } = await uc.execute({ ...base, action: 'DEACTIVATE' });
    expect(alreadyInState).toBe(false);
    expect(warning).toContain('Work Order');
  });

  it('idempotent repeat → alreadyInState, không audit', async () => {
    const { uc, audit } = setup(false);
    const { alreadyInState } = await uc.execute({ ...base, action: 'DEACTIVATE' });
    expect(alreadyInState).toBe(true);
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('action sai → 400; 404 khi không tồn tại', async () => {
    const { uc } = setup(true);
    await expect(uc.execute({ ...base, action: 'NOPE' as never })).rejects.toBeInstanceOf(BadRequestException);
    const repo = { findById: jest.fn(async () => null) } as unknown as WorkTypeRepositoryPort;
    const uc404 = new ChangeWorkTypeStatusUseCase(
      repo,
      { logWithClient: jest.fn() } as never,
      { withTransaction: jest.fn() } as never,
    );
    await expect(uc404.execute({ ...base, action: 'DEACTIVATE' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
