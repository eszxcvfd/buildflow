import {
  validateProjectAreaCreate,
  validateProjectAreaUpdate,
  validateAreaName,
  validateAreaCode,
  validateAreaReason,
} from './project-area.schema';

describe('project-area.schema PRJ-SRS-003 (issue #34)', () => {
  it('create hợp lệ: name + code optional', () => {
    expect(validateProjectAreaCreate({ name: 'Tang 1 — Khu A', code: 'T1-A' }).valid).toBe(true);
    expect(validateProjectAreaCreate({ name: 'Khu B', code: '' }).valid).toBe(true);
  });

  it('create: name trống → fieldErrors.name (mirror API 1–150)', () => {
    const res = validateProjectAreaCreate({ name: '   ', code: '' });
    expect(res.valid).toBe(false);
    expect(res.fieldErrors.name).toEqual(['Tên khu vực không được để trống']);
  });

  it('create: name quá 150 → lỗi độ dài', () => {
    const res = validateProjectAreaCreate({ name: 'x'.repeat(151), code: '' });
    expect(res.valid).toBe(false);
    expect(res.fieldErrors.name?.[0]).toContain('150');
  });

  it('create: code sai format/quá dài → fieldErrors.code', () => {
    expect(validateProjectAreaCreate({ name: 'Khu A', code: 'T 1!' }).fieldErrors.code).toEqual([
      'Mã khu vực chỉ cho phép chữ, số, _ và -',
    ]);
    const long = validateProjectAreaCreate({ name: 'Khu A', code: 'x'.repeat(51) });
    expect(long.valid).toBe(false);
    expect(long.fieldErrors.code?.[0]).toContain('50');
  });

  it('validateAreaName/validateAreaCode dùng trực tiếp', () => {
    expect(validateAreaName('Khu A')).toEqual([]);
    expect(validateAreaCode('')).toEqual([]);
    expect(validateAreaCode('T1-A')).toEqual([]);
  });

  it('update từng phần: chỉ validate field được gửi; code null = gỡ mã hợp lệ', () => {
    expect(validateProjectAreaUpdate({}).valid).toBe(true);
    expect(validateProjectAreaUpdate({ code: null }).valid).toBe(true);
    const bad = validateProjectAreaUpdate({ name: '' });
    expect(bad.valid).toBe(false);
    expect(bad.fieldErrors.name).toBeDefined();
  });

  it('reason: rỗng/null hợp lệ; quá 500 → lỗi', () => {
    expect(validateAreaReason('')).toEqual([]);
    expect(validateProjectAreaUpdate({ reason: null }).valid).toBe(true);
    const bad = validateProjectAreaUpdate({ reason: 'x'.repeat(501) });
    expect(bad.valid).toBe(false);
    expect(bad.fieldErrors.reason?.[0]).toContain('500');
  });
});
