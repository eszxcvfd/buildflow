import { validateWorkTypeCreate, validateRequiredFields } from './work-type.schema';

describe('work-type schema PRJ-SRS-004', () => {
  const base = {
    code: 'WT-001',
    name: 'Do be tong',
    description: '',
    group: '',
    requiredTradeId: '',
    requiredFields: [],
  };

  it('create hợp lệ khi tối thiểu code + name', () => {
    expect(validateWorkTypeCreate(base).valid).toBe(true);
  });

  it('bắt code trống / sai định dạng / tên quá dài', () => {
    expect(validateWorkTypeCreate({ ...base, code: '' }).fieldErrors.code).toBeDefined();
    expect(validateWorkTypeCreate({ ...base, code: 'WT 001!' }).fieldErrors.code).toBeDefined();
    expect(validateWorkTypeCreate({ ...base, name: 'x'.repeat(151) }).fieldErrors.name).toBeDefined();
  });

  it('requiredFields: bắt key trống, trùng key, SELECT thiếu options', () => {
    const dup = validateRequiredFields([
      { key: 'photos', label: 'Anh', type: 'PHOTO' },
      { key: 'Photos', label: 'Anh 2', type: 'PHOTO' },
    ]);
    expect(dup.requiredFields?.join(' ')).toMatch(/trùng/);

    const missing = validateRequiredFields([{ key: '', label: '', type: 'SELECT', options: [] }]);
    expect(missing.requiredFields).toHaveLength(3);

    const ok = validateRequiredFields([{ key: 'grade', label: 'Mac', type: 'SELECT', options: ['M200', 'M250'] }]);
    expect(ok).toEqual({});
  });
});
