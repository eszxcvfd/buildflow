import { toJobBoardDetailResponse, toJobBoardItemResponse, toJobBoardListResponse } from './job-board.mapper';
import { WorkOrderEntity } from '../../../../domain/entity/work-order.entity';

const IDS = {
  wo: '11111111-1111-4111-8111-111111111111',
  project: '22222222-2222-4222-8222-222222222222',
  area: '55555555-5555-4555-8555-555555555555',
  workType: '44444444-4444-4444-8444-444444444444',
  trade: '66666666-6666-4666-8666-666666666666',
  actor: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

const NOW = new Date('2026-11-01T08:00:00.000Z');

function makeEntity(over: Partial<Record<string, unknown>> = {}): WorkOrderEntity {
  return new WorkOrderEntity({
    id: IDS.wo,
    code: 'WO-2026-A1',
    projectId: IDS.project,
    areaId: IDS.area,
    workTypeId: IDS.workType,
    requiredTradeId: IDS.trade,
    title: 'Do be tong cot C1',
    description: 'Mo ta chi tiet',
    instructions: null,
    priority: 'HIGH',
    status: 'OPEN',
    plannedStartAt: new Date('2026-11-05T08:00:00.000Z'),
    plannedEndAt: new Date('2026-11-06T08:00:00.000Z'),
    dueAt: null,
    plannedHeadcount: 5,
    customFields: {},
    createdBy: IDS.actor,
    version: 3,
    requestKey: null,
    jobBoardOpen: true,
    jobBoardOpenFrom: new Date('2026-10-01T08:00:00.000Z'),
    jobBoardOpenUntil: new Date('2026-12-01T08:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...(over as Record<string, never>),
  });
}

function fullRefs() {
  return {
    workTypeRefs: new Map([[IDS.workType, { id: IDS.workType, code: 'WT-001', name: 'Do be tong' }]]),
    projectRefs: new Map([[IDS.project, { id: IDS.project, code: 'PRJ-001', name: 'Du an 1' }]]),
    areaRefs: new Map([[IDS.area, { id: IDS.area, code: 'A-01', name: 'Khu A' }]]),
    tradeRefs: new Map([[IDS.trade, { id: IDS.trade, code: 'TR-01', name: 'Tho xay' }]]),
    activeAssignmentIds: new Set<string>(),
    now: NOW,
  };
}

describe('job-board.mapper (JOB-SRS-005 #45, BD6)', () => {
  it('shape item đủ field card + jobBoard.state AVAILABLE, refs resolve tên', () => {
    const item = toJobBoardItemResponse(makeEntity(), fullRefs());
    expect(item).toEqual({
      id: IDS.wo,
      code: 'WO-2026-A1',
      title: 'Do be tong cot C1',
      projectId: IDS.project,
      projectName: 'Du an 1',
      areaId: IDS.area,
      areaName: 'Khu A',
      workTypeId: IDS.workType,
      workTypeName: 'Do be tong',
      requiredTradeId: IDS.trade,
      requiredTradeName: 'Tho xay',
      priority: 'HIGH',
      plannedStartAt: '2026-11-05T08:00:00.000Z',
      plannedEndAt: '2026-11-06T08:00:00.000Z',
      plannedHeadcount: 5,
      version: 3,
      jobBoard: {
        open: true,
        openFrom: '2026-10-01T08:00:00.000Z',
        openUntil: '2026-12-01T08:00:00.000Z',
        state: 'AVAILABLE',
      },
    });
  });

  it('KHÔNG chứa createdBy (PII thừa — BD6; kể cả createdBy trong entity)', () => {
    const item = toJobBoardItemResponse(makeEntity(), fullRefs());
    expect(item).not.toHaveProperty('createdBy');
    expect(JSON.stringify(item)).not.toContain(IDS.actor);
    expect(item).not.toHaveProperty('description');
    expect(item).not.toHaveProperty('customFields');
    expect(item).not.toHaveProperty('hasActiveAssignment');
  });

  it('item bị claim giữa page-SQL và enrichment → state ASSIGNED (BD5 "báo rõ")', () => {
    const item = toJobBoardItemResponse(makeEntity(), {
      ...fullRefs(),
      activeAssignmentIds: new Set([IDS.wo]),
    });
    expect(item.jobBoard.state).toBe('ASSIGNED');
  });

  it('derive state với ĐÚNG now truyền vào (until quá khứ theo now → EXPIRED)', () => {
    const item = toJobBoardItemResponse(
      makeEntity({ jobBoardOpenUntil: new Date('2026-10-15T08:00:00.000Z') }),
      fullRefs(),
    );
    expect(item.jobBoard.state).toBe('EXPIRED');
  });

  it('thiếu ref → field undefined (web fallback id rút gọn — mirror list mapper)', () => {
    const item = toJobBoardItemResponse(makeEntity(), { activeAssignmentIds: new Set(), now: NOW });
    expect(item.projectName).toBeUndefined();
    expect(item.areaName).toBeUndefined();
    expect(item.workTypeName).toBeUndefined();
    expect(item.requiredTradeName).toBeUndefined();
    expect(item.jobBoard.state).toBe('AVAILABLE');
  });

  it('areaId/trade null → giữ null, không lookup', () => {
    const item = toJobBoardItemResponse(makeEntity({ areaId: null, requiredTradeId: null }), fullRefs());
    expect(item.areaId).toBeNull();
    expect(item.areaName).toBeUndefined();
    expect(item.requiredTradeId).toBeNull();
    expect(item.requiredTradeName).toBeUndefined();
  });

  it('toJobBoardListResponse map từng entity', () => {
    const items = toJobBoardListResponse([makeEntity(), makeEntity()], fullRefs());
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe(IDS.wo);
  });
});

describe('toJobBoardDetailResponse (JOB-SRS-007 #47, §3.1)', () => {
  function detailOutput(over: Partial<Record<string, unknown>> = {}) {
    const entity = makeEntity();
    return {
      entity,
      workTypeDetail: {
        id: IDS.workType,
        name: 'Do be tong',
        description: 'Mo ta loai',
        requiredFields: [{ key: 'dien_tich', label: 'Dien tich', type: 'number' }],
        workTypeGroup: 'Ket cau',
        configVersion: 3,
      },
      projectRef: { id: IDS.project, code: 'PRJ-001', name: 'Du an 1' },
      areaRef: { id: IDS.area, code: 'A-01', name: 'Khu A' },
      tradeRef: { id: IDS.trade, code: 'TR-01', name: 'Tho xay' },
      checklists: [
        {
          id: '77777777-7777-4777-8777-777777777777',
          code: 'CL-PRE',
          name: 'Kiem tra truoc',
          purpose: 'PRE_START',
          version: 2,
          description: null,
          items: [
            { sequenceNo: 1, title: 'Muc 1', description: null, answerType: 'YES_NO', isRequired: true, isBlocking: false, requiresPhoto: false, minValue: null, maxValue: null },
          ],
        },
      ],
      hasActiveAssignment: false,
      now: NOW,
      ...(over as Record<string, never>),
    };
  }

  it('shape đủ sections §3.1 (project/area/type + required_fields, trade, planned + window, description/instructions, customFields, checklists, state, version)', () => {
    const res = toJobBoardDetailResponse(detailOutput() as never);
    expect(res).toEqual({
      id: IDS.wo,
      code: 'WO-2026-A1',
      title: 'Do be tong cot C1',
      status: 'OPEN',
      priority: 'HIGH',
      projectId: IDS.project,
      projectName: 'Du an 1',
      areaId: IDS.area,
      areaName: 'Khu A',
      workTypeId: IDS.workType,
      workTypeName: 'Do be tong',
      workTypeDescription: 'Mo ta loai',
      workTypeRequiredFields: [{ key: 'dien_tich', label: 'Dien tich', type: 'number' }],
      workTypeGroup: 'Ket cau',
      requiredTradeId: IDS.trade,
      requiredTradeName: 'Tho xay',
      plannedStartAt: '2026-11-05T08:00:00.000Z',
      plannedEndAt: '2026-11-06T08:00:00.000Z',
      dueAt: null,
      plannedHeadcount: 5,
      jobBoard: {
        open: true,
        openFrom: '2026-10-01T08:00:00.000Z',
        openUntil: '2026-12-01T08:00:00.000Z',
        state: 'AVAILABLE',
      },
      description: 'Mo ta chi tiet',
      instructions: null,
      customFields: {},
      checklists: [
        {
          id: '77777777-7777-4777-8777-777777777777',
          code: 'CL-PRE',
          name: 'Kiem tra truoc',
          purpose: 'PRE_START',
          version: 2,
          description: null,
          items: [
            { sequenceNo: 1, title: 'Muc 1', description: null, answerType: 'YES_NO', isRequired: true, isBlocking: false, requiresPhoto: false, minValue: null, maxValue: null },
          ],
        },
      ],
      version: 3,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('OMIT createdBy + requestKey + hasActiveAssignment (PII BD6 kéo dài)', () => {
    const res = toJobBoardDetailResponse(detailOutput() as never);
    expect(res).not.toHaveProperty('createdBy');
    expect(res).not.toHaveProperty('requestKey');
    expect(res.jobBoard).not.toHaveProperty('hasActiveAssignment');
    expect(res).not.toHaveProperty('hasActiveAssignment');
    expect(JSON.stringify(res)).not.toContain(IDS.actor);
  });

  it('assigned → state ASSIGNED (derive với now truyền vào)', () => {
    const res = toJobBoardDetailResponse(detailOutput({ hasActiveAssignment: true }) as never);
    expect(res.jobBoard.state).toBe('ASSIGNED');
  });

  it('ref thiếu → field undefined (không fallback id rút gọn ở detail)', () => {
    const res = toJobBoardDetailResponse(
      detailOutput({ projectRef: null, areaRef: null, tradeRef: null }) as never,
    );
    expect(res.projectName).toBeUndefined();
    expect(res.areaName).toBeUndefined();
    expect(res.requiredTradeName).toBeUndefined();
  });
});
