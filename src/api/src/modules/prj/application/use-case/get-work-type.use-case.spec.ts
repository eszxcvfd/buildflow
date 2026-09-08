import { NotFoundException } from '@nestjs/common';
import { GetWorkTypeUseCase } from './get-work-type.use-case';
import { WorkTypeEntity } from '../../domain/entity/work-type.entity';
import { WorkTypeRepositoryPort } from '../../domain/repository/work-type-repository.port';

function makeEntity(): WorkTypeEntity {
  return new WorkTypeEntity({
    id: '11111111-1111-4111-8111-111111111111',
    code: 'CONCRETE',
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

describe('GetWorkTypeUseCase (PRJ-SRS-004)', () => {
  it('trả entity kèm usage work_orders (hiện 0 — forward-ref JOB)', async () => {
    const entity = makeEntity();
    const repo = {
      findById: jest.fn(async () => entity),
      countActiveWorkOrders: jest.fn(async () => 0),
    } as unknown as WorkTypeRepositoryPort;
    const uc = new GetWorkTypeUseCase(repo);
    const { usage } = await uc.execute({ workTypeId: entity.id });
    expect(usage).toEqual({ workOrders: 0 });
  });

  it('404 khi không tồn tại', async () => {
    const repo = { findById: jest.fn(async () => null) } as unknown as WorkTypeRepositoryPort;
    const uc = new GetWorkTypeUseCase(repo);
    await expect(uc.execute({ workTypeId: 'nope' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
