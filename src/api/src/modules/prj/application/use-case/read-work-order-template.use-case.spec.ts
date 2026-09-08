import { SearchWorkOrderTemplatesUseCase } from './search-work-order-templates.use-case';
import { GetWorkOrderTemplateUseCase } from './get-work-order-template.use-case';
import { ListActiveWorkOrderTemplatesUseCase } from './list-active-work-order-templates.use-case';
import { WorkOrderTemplateEntity } from '../../domain/entity/work-order-template.entity';

function makeEntity(code = 'A'): WorkOrderTemplateEntity {
  return new WorkOrderTemplateEntity({
    id: '11111111-1111-4111-8111-111111111111',
    code: `TPL-${code}`,
    name: `Mẫu ${code}`,
    description: null,
    workTypeId: null,
    requiredTradeId: null,
    defaultDurationMinutes: null,
    defaultPriority: 'NORMAL',
    requiredSkills: [],
    checklistSnapshot: [],
    sourceChecklistTemplateId: null,
    status: 'ACTIVE',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('SearchWorkOrderTemplatesUseCase (PRJ-SRS-008)', () => {
  it('forward filter + trim search rỗng → undefined', async () => {
    const search = jest.fn(async (_f: unknown) => ({ entities: [], total: 0 }));
    const uc = new SearchWorkOrderTemplatesUseCase({ search } as never);
    await uc.execute({ status: 'ACTIVE', workTypeId: '  ', search: '   ', limit: 10, offset: 0 });
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ACTIVE', limit: 10, offset: 0 }),
    );
    const filter = search.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(filter['workTypeId']).toBeUndefined();
    expect(filter['search']).toBeUndefined();
  });
});

describe('GetWorkOrderTemplateUseCase (PRJ-SRS-008)', () => {
  it('happy path → entity; missing → 404', async () => {
    const entity = makeEntity();
    const ok = new GetWorkOrderTemplateUseCase({
      findById: jest.fn(async () => entity),
    } as never);
    expect((await ok.execute({ templateId: entity.id })).entity).toBe(entity);
    const missing = new GetWorkOrderTemplateUseCase({ findById: jest.fn(async () => null) } as never);
    await expect(missing.execute({ templateId: entity.id })).rejects.toMatchObject({ status: 404 });
  });
});

describe('ListActiveWorkOrderTemplatesUseCase (PRJ-SRS-008)', () => {
  it('delegate findAllActive (picker chỉ ACTIVE)', async () => {
    const entities = [makeEntity('A'), makeEntity('B')];
    const findAllActive = jest.fn(async () => entities);
    const uc = new ListActiveWorkOrderTemplatesUseCase({ findAllActive } as never);
    const out = await uc.execute();
    expect(out.entities).toHaveLength(2);
    expect(findAllActive).toHaveBeenCalledTimes(1);
  });
});
