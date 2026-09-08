import {
  PublishCheckSnapshot,
  evaluatePublishReadiness,
} from './work-order-publish-check.policy';

const IDS = {
  wo: '11111111-1111-4111-8111-111111111111',
  project: '22222222-2222-4222-8222-222222222222',
  otherProject: '99999999-9999-4999-8999-999999999999',
  workType: '44444444-4444-4444-8444-444444444444',
  area: '33333333-3333-4333-8333-333333333333',
  trade: '55555555-5555-4555-8555-555555555555',
  otherTrade: '66666666-6666-4666-8666-666666666666',
};

/** Snapshot đủ điều kiện (ready) — các case mutate từng trục. */
function makeReadySnapshot(): PublishCheckSnapshot {
  return {
    workOrder: {
      id: IDS.wo,
      projectId: IDS.project,
      areaId: null,
      requiredTradeId: null,
      title: 'Đổ bê tông cột C1',
      code: 'WO-2026-A1',
      description: 'Mô tả',
      instructions: 'Hướng dẫn',
      priority: 'NORMAL',
      status: 'DRAFT',
      plannedStartAt: new Date('2026-10-01T08:00:00.000Z'),
      plannedEndAt: new Date('2026-10-02T08:00:00.000Z'),
      plannedHeadcount: 5,
      customFields: {},
      jobBoardOpen: false,
    },
    project: { id: IDS.project, status: 'ACTIVE' },
    workType: { id: IDS.workType, isActive: true, requiredTradeId: null, requiredFieldsRaw: [] },
    area: null,
    workTypeTrade: null,
    workOrderTrade: null,
  };
}

describe('evaluatePublishReadiness (JOB-SRS-002)', () => {
  it('ready-path: đủ điều kiện → ready true, unmet rỗng', () => {
    const { ready, unmet } = evaluatePublishReadiness(makeReadySnapshot());
    expect(ready).toBe(true);
    expect(unmet).toEqual([]);
  });

  it('PROJECT_NOT_ACTIVE khi project PAUSED (null = pass cho area chứ không cho project)', () => {
    const s = makeReadySnapshot();
    s.project = { id: IDS.project, status: 'PAUSED' };
    const { ready, unmet } = evaluatePublishReadiness(s);
    expect(ready).toBe(false);
    expect(unmet).toEqual([
      expect.objectContaining({ code: 'PROJECT_NOT_ACTIVE', field: 'projectId' }),
    ]);
    expect(unmet[0].message).toContain('PAUSED');
  });

  it('WORK_TYPE_MISSING khi work-type không tồn tại', () => {
    const s = makeReadySnapshot();
    s.workType = null;
    const { ready, unmet } = evaluatePublishReadiness(s);
    expect(ready).toBe(false);
    expect(unmet.map((u) => u.code)).toEqual(['WORK_TYPE_MISSING']);
  });

  it('WORK_TYPE_INACTIVE khi work-type ngừng hoạt động', () => {
    const s = makeReadySnapshot();
    s.workType = { id: IDS.workType, isActive: false, requiredTradeId: null, requiredFieldsRaw: [] };
    const { ready, unmet } = evaluatePublishReadiness(s);
    expect(ready).toBe(false);
    expect(unmet.map((u) => u.code)).toEqual(['WORK_TYPE_INACTIVE']);
  });

  it('AREA_INVALID khi area khác project (null = pass)', () => {
    const s = makeReadySnapshot();
    s.workOrder.areaId = IDS.area;
    s.area = { id: IDS.area, projectId: IDS.otherProject, isActive: true };
    const { ready, unmet } = evaluatePublishReadiness(s);
    expect(ready).toBe(false);
    expect(unmet.map((u) => u.code)).toEqual(['AREA_INVALID']);
    expect(unmet[0].field).toBe('areaId');
  });

  it('AREA_INVALID khi area inactive', () => {
    const s = makeReadySnapshot();
    s.workOrder.areaId = IDS.area;
    s.area = { id: IDS.area, projectId: IDS.project, isActive: false };
    const { unmet } = evaluatePublishReadiness(s);
    expect(unmet.map((u) => u.code)).toEqual(['AREA_INVALID']);
  });

  it('MISSING_SCHEDULE per-field khi thiếu cả hai mốc', () => {
    const s = makeReadySnapshot();
    s.workOrder.plannedStartAt = null;
    s.workOrder.plannedEndAt = null;
    const { ready, unmet } = evaluatePublishReadiness(s);
    expect(ready).toBe(false);
    expect(unmet).toEqual([
      expect.objectContaining({ code: 'MISSING_SCHEDULE', field: 'plannedStartAt' }),
      expect.objectContaining({ code: 'MISSING_SCHEDULE', field: 'plannedEndAt' }),
    ]);
  });

  it('INVALID_SCHEDULE_RANGE khi end <= start', () => {
    const s = makeReadySnapshot();
    s.workOrder.plannedStartAt = new Date('2026-10-02T08:00:00.000Z');
    s.workOrder.plannedEndAt = new Date('2026-10-01T08:00:00.000Z');
    const { unmet } = evaluatePublishReadiness(s);
    expect(unmet.map((u) => u.code)).toEqual(['INVALID_SCHEDULE_RANGE']);
    expect(unmet[0].field).toBe('plannedEndAt');
  });

  it('MISSING_REQUIRED_SKILL khi work-type yêu cầu trade nhưng WO chưa gắn', () => {
    const s = makeReadySnapshot();
    s.workType = { id: IDS.workType, isActive: true, requiredTradeId: IDS.trade, requiredFieldsRaw: [] };
    s.workTypeTrade = { id: IDS.trade, isActive: true };
    const { ready, unmet } = evaluatePublishReadiness(s);
    expect(ready).toBe(false);
    expect(unmet.map((u) => u.code)).toEqual(['MISSING_REQUIRED_SKILL']);
  });

  it('MISSING_REQUIRED_SKILL khi WO gắn trade khác yêu cầu', () => {
    const s = makeReadySnapshot();
    s.workType = { id: IDS.workType, isActive: true, requiredTradeId: IDS.trade, requiredFieldsRaw: [] };
    s.workTypeTrade = { id: IDS.trade, isActive: true };
    s.workOrder.requiredTradeId = IDS.otherTrade;
    s.workOrderTrade = { id: IDS.otherTrade, isActive: true };
    const { unmet } = evaluatePublishReadiness(s);
    expect(unmet.map((u) => u.code)).toEqual(['MISSING_REQUIRED_SKILL']);
    expect(unmet[0].message).toContain('không khớp');
  });

  it('MISSING_REQUIRED_SKILL khi trade yêu cầu đã inactive', () => {
    const s = makeReadySnapshot();
    s.workType = { id: IDS.workType, isActive: true, requiredTradeId: IDS.trade, requiredFieldsRaw: [] };
    s.workTypeTrade = { id: IDS.trade, isActive: false };
    s.workOrder.requiredTradeId = IDS.trade;
    s.workOrderTrade = { id: IDS.trade, isActive: false };
    const { unmet } = evaluatePublishReadiness(s);
    expect(unmet.map((u) => u.code)).toEqual(['MISSING_REQUIRED_SKILL']);
  });

  it('MISSING_REQUIRED_FIELD per-key khi thiếu description theo required_fields', () => {
    const s = makeReadySnapshot();
    s.workType = {
      id: IDS.workType,
      isActive: true,
      requiredTradeId: null,
      requiredFieldsRaw: [{ key: 'description', label: 'Mô tả công việc', type: 'TEXT' }],
    };
    s.workOrder.description = null;
    const { ready, unmet } = evaluatePublishReadiness(s);
    expect(ready).toBe(false);
    expect(unmet).toEqual([
      expect.objectContaining({ code: 'MISSING_REQUIRED_FIELD', field: 'description' }),
    ]);
    expect(unmet[0].message).toContain('Mô tả công việc');
  });

  it('MISSING_REQUIRED_FIELD bỏ qua entry required:false và entry sai shape', () => {
    const s = makeReadySnapshot();
    s.workType = {
      id: IDS.workType,
      isActive: true,
      requiredTradeId: null,
      requiredFieldsRaw: [
        { key: 'description', label: 'Mô tả', type: 'TEXT', required: false },
        { key: '!!!', label: '', type: 'NOPE' },
      ],
    };
    s.workOrder.description = null;
    const { ready, unmet } = evaluatePublishReadiness(s);
    expect(ready).toBe(true);
    expect(unmet).toEqual([]);
  });

  it('INVALID_STATUS_FOR_PUBLISH khi status CANCELLED', () => {
    const s = makeReadySnapshot();
    s.workOrder.status = 'CANCELLED';
    const { ready, unmet } = evaluatePublishReadiness(s);
    expect(ready).toBe(false);
    expect(unmet.map((u) => u.code)).toEqual(['INVALID_STATUS_FOR_PUBLISH']);
    expect(unmet[0].field).toBe('status');
  });

  it('ALREADY_ON_JOB_BOARD khi job_board_open = true', () => {
    const s = makeReadySnapshot();
    s.workOrder.jobBoardOpen = true;
    const { ready, unmet } = evaluatePublishReadiness(s);
    expect(ready).toBe(false);
    expect(unmet.map((u) => u.code)).toEqual(['ALREADY_ON_JOB_BOARD']);
  });

  it('J8 custom_fields: key tùy chỉnh đã nhập đủ → pass (WT-OP-LAT mẫu)', () => {
    const s = makeReadySnapshot();
    s.workType = {
      id: IDS.workType,
      isActive: true,
      requiredTradeId: IDS.trade,
      requiredFieldsRaw: [
        { key: 'dien_tich', label: 'Diện tích (m²)', type: 'NUMBER' },
        { key: 'anh_nghiem_thu', label: 'Ảnh nghiệm thu', type: 'PHOTO' },
      ],
    };
    s.workOrder.requiredTradeId = IDS.trade;
    s.workTypeTrade = { id: IDS.trade, isActive: true };
    s.workOrderTrade = { id: IDS.trade, isActive: true };
    s.workOrder.customFields = { dien_tich: 120, anh_nghiem_thu: 'https://cdn.example/a.jpg' };
    const { ready, unmet } = evaluatePublishReadiness(s);
    expect(ready).toBe(true);
    expect(unmet).toEqual([]);
  });

  it('J8 custom_fields: key tùy chỉnh chưa nhập → MISSING_REQUIRED_FIELD + message Dữ liệu bổ sung', () => {
    const s = makeReadySnapshot();
    s.workType = {
      id: IDS.workType,
      isActive: true,
      requiredTradeId: null,
      requiredFieldsRaw: [
        { key: 'dien_tich', label: 'Diện tích (m²)', type: 'NUMBER' },
        { key: 'anh_nghiem_thu', label: 'Ảnh nghiệm thu', type: 'PHOTO' },
      ],
    };
    const { ready, unmet } = evaluatePublishReadiness(s);
    expect(ready).toBe(false);
    expect(unmet).toEqual([
      expect.objectContaining({ code: 'MISSING_REQUIRED_FIELD', field: 'dien_tich' }),
      expect.objectContaining({ code: 'MISSING_REQUIRED_FIELD', field: 'anh_nghiem_thu' }),
    ]);
    expect(unmet[0].message).toContain('Diện tích (m²)');
    expect(unmet[0].message).toContain('Dữ liệu bổ sung');
  });

  it('J8 custom_fields: NUMBER không parse được số → fail; chuỗi số + BOOLEAN false → pass', () => {
    const fieldsRaw = [{ key: 'dien_tich', label: 'Diện tích (m²)', type: 'NUMBER' }];
    const invalid = makeReadySnapshot();
    invalid.workType = { id: IDS.workType, isActive: true, requiredTradeId: null, requiredFieldsRaw: fieldsRaw };
    invalid.workOrder.customFields = { dien_tich: 'abc' };
    expect(evaluatePublishReadiness(invalid).ready).toBe(false);
    expect(evaluatePublishReadiness(invalid).unmet.map((u) => u.code)).toEqual(['MISSING_REQUIRED_FIELD']);

    const numericString = makeReadySnapshot();
    numericString.workType = { id: IDS.workType, isActive: true, requiredTradeId: null, requiredFieldsRaw: fieldsRaw };
    numericString.workOrder.customFields = { dien_tich: '120' };
    expect(evaluatePublishReadiness(numericString).ready).toBe(true);

    const boolFalse = makeReadySnapshot();
    boolFalse.workType = {
      id: IDS.workType,
      isActive: true,
      requiredTradeId: null,
      requiredFieldsRaw: [{ key: 'dat_kiem_dinh', label: 'Đạt kiểm định', type: 'BOOLEAN' }],
    };
    boolFalse.workOrder.customFields = { dat_kiem_dinh: false };
    const boolResult = evaluatePublishReadiness(boolFalse);
    expect(boolResult.ready).toBe(true);
    expect(boolResult.unmet).toEqual([]);
  });

  it('order deterministic theo catalog khi nhiều điều kiện cùng fail', () => {
    const s = makeReadySnapshot();
    s.project = { id: IDS.project, status: 'CLOSED' };
    s.workType = { id: IDS.workType, isActive: false, requiredTradeId: null, requiredFieldsRaw: [] };
    s.workOrder.areaId = IDS.area;
    s.area = { id: IDS.area, projectId: IDS.otherProject, isActive: true };
    s.workOrder.plannedStartAt = null;
    s.workOrder.plannedEndAt = null;
    s.workOrder.status = 'CANCELLED';
    s.workOrder.jobBoardOpen = true;
    const { ready, unmet } = evaluatePublishReadiness(s);
    expect(ready).toBe(false);
    expect(unmet.map((u) => u.code)).toEqual([
      'PROJECT_NOT_ACTIVE',
      'WORK_TYPE_INACTIVE',
      'AREA_INVALID',
      'MISSING_SCHEDULE',
      'MISSING_SCHEDULE',
      'INVALID_STATUS_FOR_PUBLISH',
      'ALREADY_ON_JOB_BOARD',
    ]);
  });
});
