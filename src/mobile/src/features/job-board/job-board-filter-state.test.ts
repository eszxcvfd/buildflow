import {
  clearJobBoardFilter, getJobBoardFilter, hasActiveJobBoardFilter, setJobBoardFilter,
  bindJobBoardFilterToken, resetJobBoardFilterBindingForTests,
  validateJobBoardFilterDates, type JobBoardFilter,
} from './job-board-filter-state';

describe('job-board-filter-state (JOB-SRS-006, issue #46)', () => {
  beforeEach(() => {
    clearJobBoardFilter();
    resetJobBoardFilterBindingForTests();
  });

  it('starts empty and reports no active filter', () => {
    expect(hasActiveJobBoardFilter(getJobBoardFilter())).toBe(false);
  });

  it('round-trips a full filter through set/get with defensive copies', () => {
    setJobBoardFilter({
      projectId: 'p-1',
      areaIds: ['a-1'],
      workTypeIds: ['w-1', 'w-2'],
      dateFrom: '2026-02-10T00:00:00+07:00',
      dateTo: '2026-02-20T00:00:00+07:00',
      skillMine: true,
    });
    const got = getJobBoardFilter();
    expect(got.projectId).toBe('p-1');
    expect(got.areaIds).toEqual(['a-1']);
    expect(got.skillMine).toBe(true);
    expect(hasActiveJobBoardFilter(got)).toBe(true);
    got.areaIds.push('mut');
    expect(getJobBoardFilter().areaIds).toEqual(['a-1']);
  });

  it('clear resets to the empty filter', () => {
    setJobBoardFilter({ projectId: 'p-1', areaIds: ['a'], workTypeIds: [], skillMine: true });
    clearJobBoardFilter();
    expect(hasActiveJobBoardFilter(getJobBoardFilter())).toBe(false);
  });

  it.each(['mine-toggle', 'date', 'area', 'type', 'project'])(
    'marks a %s-only filter as active',
    (kind) => {
      const base = { projectId: undefined, areaIds: [], workTypeIds: [], dateFrom: undefined, dateTo: undefined, skillMine: false };
      const f: JobBoardFilter = { ...base };
      if (kind === 'mine-toggle') f.skillMine = true;
      if (kind === 'date') f.dateFrom = '2026-02-10T00:00:00+07:00';
      if (kind === 'area') f.areaIds = ['a'];
      if (kind === 'type') f.workTypeIds = ['w'];
      if (kind === 'project') f.projectId = 'p';
      expect(hasActiveJobBoardFilter(f)).toBe(true);
    },
  );

  it('date validation accepts Z and ±hh:mm/±hhmm offsets, rejects naive ISO', () => {
    expect(validateJobBoardFilterDates('2026-02-10T00:00:00Z', '2026-02-20T00:00:00Z')).toEqual({});
    expect(validateJobBoardFilterDates('2026-02-10T00:00:00+07:00', '2026-02-20T00:00:00+0700')).toEqual({});
    const naive = validateJobBoardFilterDates('2026-02-10T00:00:00', undefined);
    expect(naive.dateFrom).toHaveLength(1);
    expect(naive.dateTo).toBeUndefined();
  });

  it('date validation fails BOTH fields when from > to (mirror server)', () => {
    const errs = validateJobBoardFilterDates('2026-02-20T00:00:00+07:00', '2026-02-10T00:00:00+07:00');
    expect(errs.dateFrom).toHaveLength(1);
    expect(errs.dateTo).toHaveLength(1);
  });

  it("treats ''/absent as no error", () => {
    expect(validateJobBoardFilterDates('', '')).toEqual({});
    expect(validateJobBoardFilterDates(undefined, undefined)).toEqual({});
  });

  it('F003: bind token — first bind keeps, same token keeps, changed token clears', () => {
    expect(bindJobBoardFilterToken('tok-A')).toBe(false);
    setJobBoardFilter({ projectId: 'p-1', areaIds: ['a'], workTypeIds: [], skillMine: true });
    expect(bindJobBoardFilterToken('tok-A')).toBe(false);
    expect(hasActiveJobBoardFilter(getJobBoardFilter())).toBe(true);
    expect(bindJobBoardFilterToken('tok-B')).toBe(true);
    expect(hasActiveJobBoardFilter(getJobBoardFilter())).toBe(false);
    expect(bindJobBoardFilterToken('tok-B')).toBe(false);
  });
});
