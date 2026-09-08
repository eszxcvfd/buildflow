import {
  normalizeChecklistSnapshot,
  normalizeRequiredSkills,
  normalizeWoTemplateCode,
  normalizeWoTemplateDuration,
  normalizeWoTemplateName,
  normalizeWoTemplatePriority,
} from './work-order-template.policy';

describe('work-order-template.policy (PRJ-SRS-008)', () => {
  it('code: trim + pattern; rỗng/ngắn/sai ký tự → Error', () => {
    expect(normalizeWoTemplateCode('  SLAB-01 ')).toBe('SLAB-01');
    expect(() => normalizeWoTemplateCode('x')).toThrow();
    expect(() => normalizeWoTemplateCode('a b')).toThrow();
  });

  it('name: bắt buộc; description rỗng → null', () => {
    expect(normalizeWoTemplateName(' Đổ sàn ')).toBe('Đổ sàn');
    expect(() => normalizeWoTemplateName('  ')).toThrow();
  });

  it('duration/priority: null → default; sai → Error', () => {
    expect(normalizeWoTemplateDuration(null)).toBeNull();
    expect(() => normalizeWoTemplateDuration(0)).toThrow();
    expect(() => normalizeWoTemplateDuration(1.5)).toThrow();
    expect(normalizeWoTemplatePriority(undefined)).toBe('NORMAL');
    expect(() => normalizeWoTemplatePriority('CRITICAL')).toThrow();
  });

  it('requiredSkills: shape {code,label}; trùng code CI → Error', () => {
    expect(normalizeRequiredSkills(undefined)).toEqual([]);
    expect(normalizeRequiredSkills([{ code: 'MASON', label: 'Thợ nề' }])).toEqual([
      { code: 'MASON', label: 'Thợ nề' },
    ]);
    expect(() => normalizeRequiredSkills([{ code: 'MASON' }])).toThrow();
    expect(() =>
      normalizeRequiredSkills([
        { code: 'MASON', label: 'a' },
        { code: 'mason', label: 'b' },
      ]),
    ).toThrow(/trùng code/i);
  });

  it('checklist: answerType enum + sequenceNo>0; trùng sequenceNo → Error', () => {
    expect(normalizeChecklistSnapshot(null)).toEqual([]);
    const one = {
      title: 'An toàn',
      answerType: 'YES_NO',
      isRequired: true,
      isBlocking: false,
      sequenceNo: 1,
    };
    expect(normalizeChecklistSnapshot([one])[0]).toMatchObject({ answerType: 'YES_NO', sequenceNo: 1 });
    expect(() => normalizeChecklistSnapshot([{ ...one, answerType: 'CHECK' }])).toThrow();
    expect(() => normalizeChecklistSnapshot([{ ...one, sequenceNo: 0 }])).toThrow();
    expect(() => normalizeChecklistSnapshot([one, { ...one }])).toThrow(/trùng sequenceNo/);
  });
});
