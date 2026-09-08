import { SearchWorkTypesUseCase } from './search-work-types.use-case';
import { WorkTypeEntity } from '../../domain/entity/work-type.entity';
import { WorkTypeRepositoryPort } from '../../domain/repository/work-type-repository.port';

function makeEntity(code: string, name: string, isActive = true): WorkTypeEntity {
  return new WorkTypeEntity({
    id: '11111111-1111-4111-8111-111111111111',
    code,
    name,
    description: null,
    group: 'Kết cấu',
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

function makeRepo(overrides?: Partial<WorkTypeRepositoryPort>): WorkTypeRepositoryPort {
  return {
    findById: jest.fn(async () => null),
    findByCode: jest.fn(async () => null),
    search: jest.fn(async () => ({ entities: [], total: 0 })),
    findAllActive: jest.fn(async () => []),
    findActiveTradeById: jest.fn(async () => null),
    countActiveWorkOrders: jest.fn(async () => 0),
    create: jest.fn(async () => {}),
    save: jest.fn(async () => {}),
    ...overrides,
  } as unknown as WorkTypeRepositoryPort;
}

describe('SearchWorkTypesUseCase (PRJ-SRS-004)', () => {
  it('pass filter + pagination xuống repo', async () => {
    const entity = makeEntity('CONCRETE', 'Đổ bê tông');
    const repo = makeRepo({ search: jest.fn(async () => ({ entities: [entity], total: 1 })) });
    const uc = new SearchWorkTypesUseCase(repo);
    const { entities, total } = await uc.execute({ status: 'ACTIVE', group: 'Kết cấu', limit: 10, offset: 0 });
    expect(total).toBe(1);
    expect(entities).toHaveLength(1);
    expect(repo.search).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ACTIVE', group: 'Kết cấu', limit: 10, offset: 0 }),
    );
  });
});
