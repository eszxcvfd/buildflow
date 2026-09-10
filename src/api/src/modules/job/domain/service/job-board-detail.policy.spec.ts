import { ChecklistTemplateCandidate, isJobBoardConfigError, selectChecklistsForWorkType } from './job-board-detail.policy';

const WT = '44444444-4444-4444-8444-444444444444';
const OTHER_WT = '55555555-5555-4555-8555-555555555555';

function candidate(over: Partial<ChecklistTemplateCandidate> & { code: string }): ChecklistTemplateCandidate {
  return {
    id: `${over.code}-id`,
    workTypeId: WT,
    purpose: 'PRE_START',
    version: 1,
    status: 'ACTIVE',
    ...over,
  };
}

describe('job-board-detail.policy (JOB-SRS-007 #47, BD-3)', () => {
  it('giữ ACTIVE đúng work type + generic NULL, mọi purpose', () => {
    const out = selectChecklistsForWorkType(
      [
        candidate({ code: 'CL-PER-TYPE', purpose: 'PRE_START' }),
        candidate({ code: 'CL-GENERIC', workTypeId: null, purpose: 'INSPECTION' }),
        candidate({ code: 'CL-WORK-DONE', purpose: 'WORK_DONE' }),
      ],
      WT,
    );
    expect(out.map((c) => c.code)).toEqual(['CL-GENERIC', 'CL-PER-TYPE', 'CL-WORK-DONE']);
  });

  it('loại work type khác + DRAFT + INACTIVE', () => {
    const out = selectChecklistsForWorkType(
      [
        candidate({ code: 'CL-OK' }),
        candidate({ code: 'CL-OTHER', workTypeId: OTHER_WT }),
        candidate({ code: 'CL-DRAFT', status: 'DRAFT' }),
        candidate({ code: 'CL-INACTIVE', status: 'INACTIVE' }),
      ],
      WT,
    );
    expect(out.map((c) => c.code)).toEqual(['CL-OK']);
  });

  it('nhiều ACTIVE version cùng code → giữ version cao nhất', () => {
    const out = selectChecklistsForWorkType(
      [
        candidate({ code: 'CL-DUP', version: 1 }),
        candidate({ code: 'CL-DUP', version: 3 }),
        candidate({ code: 'CL-DUP', version: 2 }),
      ],
      WT,
    );
    expect(out).toHaveLength(1);
    expect(out[0].version).toBe(3);
  });

  it('generic và per-type cùng code → version cao nhất thắng (không phân biệt nguồn)', () => {
    const out = selectChecklistsForWorkType(
      [
        candidate({ code: 'CL-DUP', version: 1 }),
        candidate({ code: 'CL-DUP', version: 2, workTypeId: null }),
      ],
      WT,
    );
    expect(out).toHaveLength(1);
    expect(out[0].version).toBe(2);
    expect(out[0].workTypeId).toBeNull();
  });

  it('0 template → [] (empty state hợp lệ, không phải config error)', () => {
    expect(selectChecklistsForWorkType([], WT)).toEqual([]);
    expect(selectChecklistsForWorkType([candidate({ code: 'CL-OTHER', workTypeId: OTHER_WT })], WT)).toEqual([]);
  });

  it('isJobBoardConfigError: null/undefined → true; object → false', () => {
    expect(isJobBoardConfigError(null)).toBe(true);
    expect(isJobBoardConfigError(undefined)).toBe(true);
    expect(isJobBoardConfigError({ id: WT, name: 'X' })).toBe(false);
  });
});
