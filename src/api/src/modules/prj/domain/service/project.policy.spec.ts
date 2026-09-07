import {
  assertPlannedDates,
  isValidIsoDateString,
  normalizeProjectAddress,
  normalizeProjectCode,
  normalizeProjectDescription,
  normalizeProjectName,
  normalizeProjectTimezone,
} from './project.policy';

describe('project.policy PRJ-SRS-001 (issue #32)', () => {
  it('isValidIsoDateString: loại ngày không tồn tại trên lịch', () => {
    expect(isValidIsoDateString('2026-09-07')).toBe(true);
    expect(isValidIsoDateString('2026-02-30')).toBe(false);
    expect(isValidIsoDateString('2026-13-01')).toBe(false);
    expect(isValidIsoDateString('07/09/2026')).toBe(false);
    expect(isValidIsoDateString('2026-9-7')).toBe(false);
  });

  it('normalizeProjectCode: 2-50 + ^[A-Za-z0-9_-]+$', () => {
    expect(normalizeProjectCode(' PRJ-001 ')).toBe('PRJ-001');
    expect(() => normalizeProjectCode('A')).toThrow(/2 đến 50/);
    expect(() => normalizeProjectCode('x'.repeat(51))).toThrow(/2 đến 50/);
    expect(() => normalizeProjectCode('PRJ 001')).toThrow(/chữ, số/);
  });

  it('normalizeProjectName/Address: required + giới hạn độ dài', () => {
    expect(() => normalizeProjectName('')).toThrow(/Tên dự án/);
    expect(() => normalizeProjectName('x'.repeat(201))).toThrow(/200/);
    expect(() => normalizeProjectAddress('')).toThrow(/Địa chỉ/);
    expect(() => normalizeProjectAddress('x'.repeat(501))).toThrow(/500/);
  });

  it('normalizeProjectDescription: optional ≤2000, rỗng → null', () => {
    expect(normalizeProjectDescription(undefined)).toBeNull();
    expect(normalizeProjectDescription('   ')).toBeNull();
    expect(() => normalizeProjectDescription('x'.repeat(2001))).toThrow(/2000/);
  });

  it('normalizeProjectTimezone: default Asia/Ho_Chi_Minh, ≤64', () => {
    expect(normalizeProjectTimezone(undefined)).toBe('Asia/Ho_Chi_Minh');
    expect(normalizeProjectTimezone('')).toBe('Asia/Ho_Chi_Minh');
    expect(() => normalizeProjectTimezone('x'.repeat(65))).toThrow(/64/);
  });

  it('assertPlannedDates: required ISO + end >= start', () => {
    expect(() => assertPlannedDates('2026-09-01', '2026-09-01')).not.toThrow();
    expect(() => assertPlannedDates('2026-09-02', '2026-09-01')).toThrow(/từ ngày bắt đầu/);
    expect(() => assertPlannedDates('not-a-date', '2026-09-01')).toThrow(/bắt đầu/);
    expect(() => assertPlannedDates('2026-09-01', '')).toThrow(/kết thúc/);
  });
});
