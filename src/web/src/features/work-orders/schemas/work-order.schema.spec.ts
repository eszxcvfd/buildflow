import {
  validateWorkOrderCreate,
  toCreateWorkOrderPayload,
  defaultWorkOrderFormValues,
} from './work-order.schema';

const REQ_KEY = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TYPE_ID = '22222222-2222-4222-8222-222222222222';

function valid() {
  return {
    ...defaultWorkOrderFormValues(),
    title: 'Do be tong cot C1',
    workTypeId: TYPE_ID,
  };
}

describe('work-order schema JOB-SRS-001', () => {
  it('defaults hợp lệ khi đủ title + workTypeId', () => {
    const r = validateWorkOrderCreate(valid());
    expect(r.valid).toBe(true);
    expect(r.fieldErrors).toEqual({});
  });

  it('title bắt buộc, tối đa 200', () => {
    expect(validateWorkOrderCreate({ ...valid(), title: '  ' }).fieldErrors.title).toEqual([
      'Tiêu đề công việc không được để trống',
    ]);
    expect(validateWorkOrderCreate({ ...valid(), title: 'x'.repeat(201) }).fieldErrors.title).toEqual([
      'Tiêu đề công việc tối đa 200 ký tự',
    ]);
  });

  it('workTypeId bắt buộc; areaId/tradeId sai uuid bị chặn', () => {
    expect(validateWorkOrderCreate({ ...valid(), workTypeId: '' }).fieldErrors.workTypeId).toEqual([
      'Loại công việc không được để trống',
    ]);
    expect(validateWorkOrderCreate({ ...valid(), areaId: 'not-uuid' }).fieldErrors.areaId).toEqual([
      'Khu vực không hợp lệ',
    ]);
    expect(validateWorkOrderCreate({ ...valid(), requiredTradeId: 'zzz' }).fieldErrors.requiredTradeId).toEqual([
      'Ngành nghề yêu cầu không hợp lệ',
    ]);
  });

  it('priority ngoài enum bị chặn', () => {
    const r = validateWorkOrderCreate({ ...valid(), priority: 'CRITICAL' as never });
    expect(r.valid).toBe(false);
    expect(r.fieldErrors.priority).toBeDefined();
  });

  it('planned end phải sau start', () => {
    const r = validateWorkOrderCreate({
      ...valid(),
      plannedStartAt: '2026-03-02T10:00',
      plannedEndAt: '2026-03-01T10:00',
    });
    expect(r.valid).toBe(false);
    expect(r.fieldErrors.plannedEndAt).toEqual(['Thời điểm kết thúc kế hoạch phải sau thời điểm bắt đầu']);
  });

  it('một đầu planned bỏ trống vẫn hợp lệ', () => {
    expect(validateWorkOrderCreate({ ...valid(), plannedStartAt: '2026-03-02T10:00' }).valid).toBe(true);
  });

  it('headcount chỉ nhận int 1..99', () => {
    for (const bad of ['0', '100', 'abc', '2.5']) {
      expect(validateWorkOrderCreate({ ...valid(), plannedHeadcount: bad }).fieldErrors.plannedHeadcount).toBeDefined();
    }
    expect(validateWorkOrderCreate({ ...valid(), plannedHeadcount: '12' }).valid).toBe(true);
    expect(validateWorkOrderCreate({ ...valid(), plannedHeadcount: '' }).valid).toBe(true);
  });

  it('description/instructions tối đa 5000', () => {
    expect(validateWorkOrderCreate({ ...valid(), description: 'x'.repeat(5001) }).fieldErrors.description).toBeDefined();
    expect(validateWorkOrderCreate({ ...valid(), instructions: 'x'.repeat(5001) }).fieldErrors.instructions).toBeDefined();
  });

  it('toCreateWorkOrderPayload map + ISO + requestKey', () => {
    const p = toCreateWorkOrderPayload(
      PROJECT_ID,
      { ...valid(), plannedStartAt: '2026-03-02T10:00', plannedHeadcount: '8', code: '  ' },
      REQ_KEY,
    );
    expect(p).toMatchObject({
      projectId: PROJECT_ID,
      title: 'Do be tong cot C1',
      workTypeId: TYPE_ID,
      priority: 'NORMAL',
      plannedHeadcount: 8,
      requestKey: REQ_KEY,
    });
    expect(p.code).toBeNull();
    expect(p.areaId).toBeNull();
    expect(p.plannedStartAt).toContain('2026-03-02');
    expect(p.plannedEndAt).toBeNull();
  });
});
