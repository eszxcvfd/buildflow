import {
  validateWorkOrderTemplateCreate,
  validateWorkOrderTemplateUpdate,
  validateRequiredSkills,
  validateChecklistSnapshot,
} from './work-order-template.schema';

describe('work-order-template schema PRJ-SRS-008', () => {
  const base = {
    code: 'WOT-001',
    name: 'Do be tong chuan',
    description: '',
    workTypeId: '',
    requiredTradeId: '',
    requiredSkills: [],
    checklistSnapshot: [],
  };

  it('create hợp lệ khi tối thiểu code + name', () => {
    expect(validateWorkOrderTemplateCreate(base).valid).toBe(true);
  });

  it('bắt code trống / sai định dạng / tên quá dài', () => {
    expect(validateWorkOrderTemplateCreate({ ...base, code: '' }).fieldErrors.code).toBeDefined();
    expect(validateWorkOrderTemplateCreate({ ...base, code: 'WOT 001!' }).fieldErrors.code).toBeDefined();
    expect(validateWorkOrderTemplateCreate({ ...base, name: 'x'.repeat(151) }).fieldErrors.name).toBeDefined();
  });

  it('requiredSkills: bắt code trống, trùng code, label trống', () => {
    const dup = validateRequiredSkills([
      { code: 'THO-XAY', label: 'Tho xay' },
      { code: 'tho-xay', label: 'Tho xay 2' },
    ]);
    expect(dup.requiredSkills?.join(' ')).toMatch(/trùng/);

    const missing = validateRequiredSkills([{ code: '', label: '' }]);
    expect(missing.requiredSkills).toHaveLength(2);

    const ok = validateRequiredSkills([{ code: 'THO-XAY', label: 'Tho xay' }]);
    expect(ok).toEqual({});
  });

  it('checklistSnapshot: bắt title trống, answerType sai', () => {
    const bad = validateChecklistSnapshot([
      { title: '', answerType: 'YES_NO', isRequired: true, isBlocking: false, sequenceNo: 1 },
      { title: 'Muc 2', answerType: 'WRONG', isRequired: false, isBlocking: false, sequenceNo: 2 },
    ]);
    expect(bad.checklistSnapshot).toHaveLength(2);

    const ok = validateChecklistSnapshot([
      { title: 'Kiem tra', answerType: 'PASS_FAIL', isRequired: true, isBlocking: true, requiresPhoto: true, sequenceNo: 1 },
    ]);
    expect(ok).toEqual({});
  });

  it('defaultDurationMinutes: tùy chọn, rỗng hợp lệ, chỉ nhận số nguyên dương', () => {
    expect(validateWorkOrderTemplateCreate(base).valid).toBe(true);
    expect(validateWorkOrderTemplateCreate({ ...base, defaultDurationMinutes: '' }).valid).toBe(true);
    expect(validateWorkOrderTemplateCreate({ ...base, defaultDurationMinutes: '120' }).valid).toBe(true);
    expect(validateWorkOrderTemplateCreate({ ...base, defaultDurationMinutes: 'abc' }).fieldErrors.defaultDurationMinutes).toBeDefined();
    expect(validateWorkOrderTemplateCreate({ ...base, defaultDurationMinutes: '0' }).fieldErrors.defaultDurationMinutes).toBeDefined();
    expect(validateWorkOrderTemplateCreate({ ...base, defaultDurationMinutes: '1.5' }).fieldErrors.defaultDurationMinutes).toBeDefined();
  });

  it('defaultPriority: tùy chọn, chỉ nhận LOW/NORMAL/HIGH/URGENT', () => {
    expect(validateWorkOrderTemplateCreate({ ...base, defaultPriority: 'HIGH' }).valid).toBe(true);
    expect(validateWorkOrderTemplateCreate({ ...base, defaultPriority: 'KHAN_CAP' }).fieldErrors.defaultPriority).toBeDefined();
  });

  it('update: chỉ validate trường được truyền', () => {
    expect(validateWorkOrderTemplateUpdate({}).valid).toBe(true);
    expect(validateWorkOrderTemplateUpdate({ defaultDurationMinutes: '-5' }).fieldErrors.defaultDurationMinutes).toBeDefined();
    expect(validateWorkOrderTemplateUpdate({ defaultPriority: 'URGENT' }).valid).toBe(true);
    expect(validateWorkOrderTemplateUpdate({ requiredSkills: [{ code: '', label: 'x' }] }).fieldErrors.requiredSkills).toBeDefined();
  });
});
