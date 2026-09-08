import {
  WORK_ORDER_CODE_RE,
  assertPlannedRange,
  generateWorkOrderCode,
  normalizePlannedHeadcount,
  normalizeRequestKey,
  normalizeWorkOrderCode,
  normalizeWorkOrderPriority,
  normalizeWorkOrderText,
  normalizeWorkOrderTitle,
  parsePlannedDateTime,
} from './work-order.policy';

describe('work-order.policy (JOB-SRS-001)', () => {
  it('title: 1-200 sau trim; rỗng/quá dài → Error', () => {
    expect(normalizeWorkOrderTitle('  Đổ bê tông  ')).toBe('Đổ bê tông');
    expect(() => normalizeWorkOrderTitle('   ')).toThrow('không được để trống');
    expect(() => normalizeWorkOrderTitle('x'.repeat(201))).toThrow('tối đa 200');
  });

  it('code: absent → null; pattern ^[A-Za-z0-9][A-Za-z0-9-]{2,49}$', () => {
    expect(normalizeWorkOrderCode(undefined)).toBeNull();
    expect(normalizeWorkOrderCode(null)).toBeNull();
    expect(normalizeWorkOrderCode('  ')).toBeNull();
    expect(normalizeWorkOrderCode('WO-2026-A1')).toBe('WO-2026-A1');
    expect(() => normalizeWorkOrderCode('AB')).toThrow();
    expect(() => normalizeWorkOrderCode('-ABC')).toThrow();
    expect(() => normalizeWorkOrderCode('A'.repeat(51))).toThrow();
    expect(WORK_ORDER_CODE_RE.test('WO-ABC-123')).toBe(true);
  });

  it('generateWorkOrderCode: prefix WO- + khớp pattern client-supplied', () => {
    const code = generateWorkOrderCode(1700000000000, () => 'A');
    expect(code.startsWith('WO-')).toBe(true);
    expect(WORK_ORDER_CODE_RE.test(code)).toBe(true);
    const another = generateWorkOrderCode(Date.now());
    expect(WORK_ORDER_CODE_RE.test(another)).toBe(true);
  });

  it('priority: absent → NORMAL; sai enum → Error', () => {
    expect(normalizeWorkOrderPriority(undefined)).toBe('NORMAL');
    expect(normalizeWorkOrderPriority('HIGH')).toBe('HIGH');
    expect(() => normalizeWorkOrderPriority('CRITICAL')).toThrow();
  });

  it('text: rỗng → null; quá 5000 → Error', () => {
    expect(normalizeWorkOrderText('  ', 'Mô tả công việc')).toBeNull();
    expect(normalizeWorkOrderText('ok', 'Mô tả công việc')).toBe('ok');
    expect(() => normalizeWorkOrderText('x'.repeat(5001), 'Mô tả công việc')).toThrow('tối đa 5000');
  });

  it('headcount: null hoặc int 1-99', () => {
    expect(normalizePlannedHeadcount(undefined)).toBeNull();
    expect(normalizePlannedHeadcount(5)).toBe(5);
    expect(() => normalizePlannedHeadcount(0)).toThrow();
    expect(() => normalizePlannedHeadcount(100)).toThrow();
    expect(() => normalizePlannedHeadcount(1.5)).toThrow();
  });

  it('dates: ISO hợp lệ; cả hai → start < end', () => {
    expect(parsePlannedDateTime(undefined)).toBeNull();
    const start = parsePlannedDateTime('2026-10-01T08:00:00.000Z');
    const end = parsePlannedDateTime('2026-10-02T08:00:00.000Z');
    expect(start).toBeInstanceOf(Date);
    expect(() => assertPlannedRange(start, end)).not.toThrow();
    expect(() => assertPlannedRange(end, start)).toThrow('phải sau thời điểm bắt đầu');
    expect(() => assertPlannedRange(start, start)).toThrow();
    // Một mốc lẻ luôn hợp lệ (nháp thiếu schedule vẫn DRAFT).
    expect(() => assertPlannedRange(start, null)).not.toThrow();
    expect(() => assertPlannedRange(null, null)).not.toThrow();
    expect(() => parsePlannedDateTime('không-phải-ngày')).toThrow('ISO 8601');
  });

  it('requestKey: absent → null; sai UUID → Error', () => {
    expect(normalizeRequestKey(undefined)).toBeNull();
    expect(normalizeRequestKey('  ')).toBeNull();
    const key = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';
    expect(normalizeRequestKey(key)).toBe(key);
    expect(() => normalizeRequestKey('not-a-uuid')).toThrow('UUID');
  });
});
