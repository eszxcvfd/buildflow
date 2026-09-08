import { WorkOrderEntity } from '../../../../domain/entity/work-order.entity';
import { toWorkOrderResponse } from './work-order.mapper';

const IDS = {
  id: '11111111-1111-4111-8111-111111111111',
  project: '22222222-2222-4222-8222-222222222222',
  area: '33333333-3333-4333-8333-333333333333',
  workType: '44444444-4444-4444-8444-444444444444',
  trade: '55555555-5555-4555-8555-555555555555',
  actor: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

function makeEntity(): WorkOrderEntity {
  return new WorkOrderEntity({
    id: IDS.id,
    code: 'WO-2026-A1',
    projectId: IDS.project,
    areaId: IDS.area,
    workTypeId: IDS.workType,
    requiredTradeId: IDS.trade,
    title: 'Đổ bê tông cột C1',
    description: 'Mô tả',
    instructions: 'Hướng dẫn',
    priority: 'HIGH',
    status: 'DRAFT',
    plannedStartAt: new Date('2026-10-01T08:00:00.000Z'),
    plannedEndAt: new Date('2026-10-02T08:00:00.000Z'),
    plannedHeadcount: 5,
    createdBy: IDS.actor,
    version: 1,
    requestKey: '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  });
}

describe('work-order.mapper (JOB-SRS-001)', () => {
  it('map summary đầy đủ, ISO dates, workTypeName optional', () => {
    const dto = toWorkOrderResponse(makeEntity(), { workTypeName: 'Đổ bê tông' });
    expect(dto).toMatchObject({
      id: IDS.id,
      code: 'WO-2026-A1',
      projectId: IDS.project,
      areaId: IDS.area,
      workTypeId: IDS.workType,
      workTypeName: 'Đổ bê tông',
      requiredTradeId: IDS.trade,
      title: 'Đổ bê tông cột C1',
      priority: 'HIGH',
      status: 'DRAFT',
      plannedStartAt: '2026-10-01T08:00:00.000Z',
      plannedEndAt: '2026-10-02T08:00:00.000Z',
      plannedHeadcount: 5,
      createdBy: IDS.actor,
      version: 1,
    });
    expect(dto.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(dto.idempotentReplay).toBeUndefined();
  });

  it('requestKey bị OMIT khỏi response (chỉ nằm trong audit afterData)', () => {
    const dto = toWorkOrderResponse(makeEntity());
    expect('requestKey' in dto).toBe(false);
    expect(dto.workTypeName).toBeUndefined();
  });

  it('null dates giữ null; gắn idempotentReplay khi replay', () => {
    const e = new WorkOrderEntity({
      ...makeEntity().getProps(),
      areaId: null,
      requiredTradeId: null,
      plannedStartAt: null,
      plannedEndAt: null,
      plannedHeadcount: null,
    });
    const dto = toWorkOrderResponse(e, { workTypeName: null, idempotentReplay: true });
    expect(dto.plannedStartAt).toBeNull();
    expect(dto.plannedEndAt).toBeNull();
    expect(dto.plannedHeadcount).toBeNull();
    expect(dto.idempotentReplay).toBe(true);
  });
});
