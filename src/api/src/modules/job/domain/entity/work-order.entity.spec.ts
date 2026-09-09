import { WorkOrderEntity, WorkOrderProps, WorkOrderStatus } from './work-order.entity';

const IDS = {
  id: '11111111-1111-4111-8111-111111111111',
  project: '22222222-2222-4222-8222-222222222222',
  area: '33333333-3333-4333-8333-333333333333',
  workType: '44444444-4444-4444-8444-444444444444',
  trade: '55555555-5555-4555-8555-555555555555',
  actor: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

function baseProps(overrides?: Partial<WorkOrderProps>): WorkOrderProps {
  return {
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
    dueAt: null,
    plannedHeadcount: 5,
    customFields: {},
    createdBy: IDS.actor,
    version: 1,
    requestKey: null,
    jobBoardOpen: false,
    jobBoardOpenFrom: null,
    jobBoardOpenUntil: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('WorkOrderEntity (JOB-SRS-001)', () => {
  it('tạo nháp hợp lệ, luôn DRAFT version 1', () => {
    const e = new WorkOrderEntity(baseProps());
    expect(e.isDraft()).toBe(true);
    expect(e.status).toBe('DRAFT');
    expect(e.version).toBe(1);
    expect(e.toPublic().createdBy).toBe(IDS.actor);
  });

  it('thiếu schedule/area/trade vẫn DRAFT (draft minimal — không chặn tạo)', () => {
    const e = new WorkOrderEntity(
      baseProps({ areaId: null, requiredTradeId: null, plannedStartAt: null, plannedEndAt: null, plannedHeadcount: null }),
    );
    expect(e.isDraft()).toBe(true);
    expect(e.areaId).toBeNull();
    expect(e.requiredTradeId).toBeNull();
    expect(e.plannedStartAt).toBeNull();
  });

  it('reject id/project/workType/actor sai UUID, code/title sai', () => {
    expect(() => new WorkOrderEntity(baseProps({ id: 'nope' }))).toThrow();
    expect(() => new WorkOrderEntity(baseProps({ projectId: 'nope' }))).toThrow();
    expect(() => new WorkOrderEntity(baseProps({ workTypeId: 'nope' }))).toThrow();
    expect(() => new WorkOrderEntity(baseProps({ code: 'AB' }))).toThrow();
    expect(() => new WorkOrderEntity(baseProps({ title: '   ' }))).toThrow();
    expect(() => new WorkOrderEntity(baseProps({ version: 0 }))).toThrow();
  });

  it('createDraft giữ invariant DRAFT-at-creation (status khác DRAFT → reject)', () => {
    const e = WorkOrderEntity.createDraft({ ...baseProps(), status: 'DRAFT' });
    expect(e.isDraft()).toBe(true);
    expect(() => WorkOrderEntity.createDraft({ ...baseProps(), status: 'READY' as 'DRAFT' })).toThrow('DRAFT');
  });

  it('G1 regression: rehydrate row ASSIGNED (full DB enum) không throw', () => {
    const e = WorkOrderEntity.fromPersistence(baseProps({ status: 'ASSIGNED' }));
    expect(e.status).toBe('ASSIGNED');
    expect(e.isDraft()).toBe(false);
    const all: WorkOrderStatus[] = [
      'DRAFT', 'READY', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WORK_DONE', 'CLOSED', 'CANCELLED',
    ];
    for (const status of all) {
      expect(() => WorkOrderEntity.fromPersistence(baseProps({ status }))).not.toThrow();
    }
    expect(() => WorkOrderEntity.fromPersistence(baseProps({ status: 'GHOST' as WorkOrderStatus }))).toThrow();
  });

  it('toPublic expose public fields, không secret', () => {
    const pub = new WorkOrderEntity(baseProps()).toPublic();
    expect(pub).toMatchObject({ code: 'WO-2026-A1', priority: 'HIGH', status: 'DRAFT', version: 1 });
    expect(Object.keys(pub).sort()).toEqual(
      [
        'id', 'code', 'projectId', 'areaId', 'workTypeId', 'requiredTradeId', 'title',
        'description', 'instructions', 'priority', 'status', 'plannedStartAt', 'plannedEndAt',
        'dueAt', 'plannedHeadcount', 'jobBoardOpen', 'jobBoardOpenFrom', 'jobBoardOpenUntil',
        'customFields', 'createdBy', 'version', 'requestKey', 'createdAt', 'updatedAt',
      ].sort(),
    );
  });
});
