import {
  normalizeRequiredFields,
  normalizeWorkTypeCode,
  normalizeWorkTypeGroup,
  normalizeWorkTypeName,
} from './work-type.policy';

describe('work-type.policy (PRJ-SRS-004)', () => {
  it('normalize code/name/group', () => {
    expect(normalizeWorkTypeCode(' AB-12 ')).toBe('AB-12');
    expect(() => normalizeWorkTypeCode('a')).toThrow();
    expect(() => normalizeWorkTypeCode('bad code!')).toThrow();
    expect(normalizeWorkTypeName('  Sơn  ')).toBe('Sơn');
    expect(() => normalizeWorkTypeName('')).toThrow();
    expect(normalizeWorkTypeGroup('')).toBeNull();
    expect(normalizeWorkTypeGroup('  Kết cấu  ')).toBe('Kết cấu');
  });

  it('required_fields hợp lệ → normalize', () => {
    const out = normalizeRequiredFields([
      { key: 'photo', label: 'Ảnh hiện trường', type: 'photo', required: true },
      { key: 'qty', label: 'Khối lượng', type: 'NUMBER' },
      { key: 'method', label: 'Biện pháp', type: 'select', options: ['A', 'B'] },
    ]);
    expect(out).toHaveLength(3);
    expect(out[0].type).toBe('PHOTO');
    expect(out[2].options).toEqual(['A', 'B']);
  });

  it('required_fields sai shape → Error', () => {
    expect(() => normalizeRequiredFields('nope')).toThrow('phải là mảng');
    expect(() => normalizeRequiredFields([{ label: 'x', type: 'TEXT' }])).toThrow('key');
    expect(() => normalizeRequiredFields([{ key: 'k', label: 'x', type: 'VIDEO' }])).toThrow('type');
    expect(() => normalizeRequiredFields([
      { key: 'k', label: 'a', type: 'TEXT' },
      { key: 'K', label: 'b', type: 'TEXT' },
    ])).toThrow('trùng key');
    expect(() => normalizeRequiredFields([{ key: 'k', label: 'a', type: 'SELECT' }])).toThrow('option');
    expect(() => normalizeRequiredFields([{ key: 'k', label: 'a', type: 'TEXT', options: ['x'] }])).toThrow('options');
  });
});
