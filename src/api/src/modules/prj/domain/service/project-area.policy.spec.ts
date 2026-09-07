import {
  normalizeProjectAreaCode,
  normalizeProjectAreaName,
  normalizeProjectAreaReason,
} from './project-area.policy';

describe('project-area.policy PRJ-SRS-003 (issue #34)', () => {
  it('normalizeProjectAreaName: trim; trống → throw; >150 → throw', () => {
    expect(normalizeProjectAreaName('  Khu A  ')).toBe('Khu A');
    expect(() => normalizeProjectAreaName('   ')).toThrow('Tên khu vực không được để trống');
    expect(() => normalizeProjectAreaName('x'.repeat(151))).toThrow('Tên khu vực tối đa 150 ký tự');
  });

  it('normalizeProjectAreaCode: optional → null; trim; sai format/dài → throw', () => {
    expect(normalizeProjectAreaCode(undefined)).toBeNull();
    expect(normalizeProjectAreaCode(null)).toBeNull();
    expect(normalizeProjectAreaCode('  ')).toBeNull();
    expect(normalizeProjectAreaCode(' kv-01 ')).toBe('kv-01');
    expect(() => normalizeProjectAreaCode('KV 01!')).toThrow('Mã khu vực chỉ cho phép chữ, số, _ và -');
    expect(() => normalizeProjectAreaCode('x'.repeat(51))).toThrow('Mã khu vực tối đa 50 ký tự');
  });

  it('normalizeProjectAreaReason: optional → null; >500 → throw', () => {
    expect(normalizeProjectAreaReason(undefined)).toBeNull();
    expect(normalizeProjectAreaReason('  ')).toBeNull();
    expect(normalizeProjectAreaReason(' Hết việc ')).toBe('Hết việc');
    expect(() => normalizeProjectAreaReason('x'.repeat(501))).toThrow('Lý do tối đa 500 ký tự');
  });
});
