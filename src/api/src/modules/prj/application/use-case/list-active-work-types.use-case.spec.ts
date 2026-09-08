import { ListActiveWorkTypesUseCase } from './list-active-work-types.use-case';
import { WorkTypeEntity } from '../../domain/entity/work-type.entity';
import { WorkTypeRepositoryPort } from '../../domain/repository/work-type-repository.port';

function makeEntity(code: string, name: string): WorkTypeEntity {
  return new WorkTypeEntity({
    id: '11111111-1111-4111-8111-111111111111',
    code,
    name,
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

describe('ListActiveWorkTypesUseCase (PRJ-SRS-004 picker)', () => {
  it('chỉ trả active (sắp theo name do repo đảm nhiệm)', async () => {
    const repo = {
      findAllActive: jest.fn(async () => [makeEntity('BB', 'Bê tông'), makeEntity('AA', 'Xây')]),
    } as unknown as WorkTypeRepositoryPort;
    const uc = new ListActiveWorkTypesUseCase(repo);
    const { entities } = await uc.execute();
    expect(entities).toHaveLength(2);
    expect(entities.every((e) => e.isActive)).toBe(true);
  });
});
