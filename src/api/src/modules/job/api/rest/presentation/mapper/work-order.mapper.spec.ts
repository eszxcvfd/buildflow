import { WorkOrderEntity } from '../../../../domain/entity/work-order.entity';
import { toWorkOrderListResponse, toWorkOrderResponse } from './work-order.mapper';

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
    dueAt: new Date('2026-10-05T08:00:00.000Z'),
    plannedHeadcount: 5,
    customFields: {},
    createdBy: IDS.actor,
    version: 1,
    requestKey: '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b',
    jobBoardOpen: false,
    jobBoardOpenFrom: null,
    jobBoardOpenUntil: null,
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
      dueAt: '2026-10-05T08:00:00.000Z',
      plannedHeadcount: 5,
      customFields: {},
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
      dueAt: null,
      plannedHeadcount: null,
      customFields: {},
    });
    const dto = toWorkOrderResponse(e, { workTypeName: null, idempotentReplay: true });
    expect(dto.plannedStartAt).toBeNull();
    expect(dto.plannedEndAt).toBeNull();
    expect(dto.dueAt).toBeNull();
    expect(dto.plannedHeadcount).toBeNull();
    expect(dto.idempotentReplay).toBe(true);
  });

  it('toWorkOrderListResponse: gắn workTypeName/projectName từ refs; thiếu ref → undefined', () => {
    const rows = toWorkOrderListResponse([makeEntity()], {
      workTypeRefs: new Map([[IDS.workType, { id: IDS.workType, code: 'WT-001', name: 'Đổ bê tông' }]]),
      projectRefs: new Map([[IDS.project, { id: IDS.project, code: 'PRJ-001', name: 'Dự án 1' }]]),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ workTypeName: 'Đổ bê tông', projectName: 'Dự án 1' });

    const bare = toWorkOrderListResponse([makeEntity()], { workTypeRefs: new Map(), projectRefs: new Map() });
    expect(bare[0].workTypeName).toBeUndefined();
    expect(bare[0].projectName).toBeUndefined();
  });

  it('JOB-SRS-004: không truyền hasActiveAssignment → response KHÔNG có jobBoard (list)', () => {
    const dto = toWorkOrderResponse(makeEntity(), { workTypeName: 'Đổ bê tông' });
    expect('jobBoard' in dto).toBe(false);
  });

  it('JOB-SRS-004: GET :id trả jobBoard + state server-derived', () => {
    const open = new WorkOrderEntity({
      ...makeEntity().getProps(),
      status: 'OPEN',
      jobBoardOpen: true,
      jobBoardOpenFrom: new Date('2026-09-01T08:00:00.000Z'),
      jobBoardOpenUntil: new Date('2026-12-01T08:00:00.000Z'),
    });
    const dto = toWorkOrderResponse(open, { hasActiveAssignment: false });
    expect(dto.jobBoard).toMatchObject({
      open: true,
      openFrom: '2026-09-01T08:00:00.000Z',
      openUntil: '2026-12-01T08:00:00.000Z',
      hasActiveAssignment: false,
      state: 'AVAILABLE',
    });

    const assigned = toWorkOrderResponse(open, { hasActiveAssignment: true });
    expect(assigned.jobBoard?.state).toBe('ASSIGNED');

    const closed = toWorkOrderResponse(makeEntity(), { hasActiveAssignment: false });
    expect(closed.jobBoard).toMatchObject({ open: false, state: 'CLOSED' });
  });
});
