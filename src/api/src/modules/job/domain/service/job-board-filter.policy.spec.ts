import { JobBoardFilterError, parseJobBoardFilters } from './job-board-filter.policy';

const UUID = '22222222-2222-4222-8222-222222222222';
const UUID2 = '33333333-3333-4333-8333-333333333333';

describe('parseJobBoardFilters (JOB-SRS-006 #46)', () => {
  it('absent/undefined → không filter (skillMine false)', () => {
    expect(parseJobBoardFilters({})).toEqual({
      projectId: undefined,
      areaIds: undefined,
      workTypeIds: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      skillMine: false,
    });
  });

  it(`'' = absent cho mọi param`, () => {
    const out = parseJobBoardFilters({
      projectId: '',
      areaId: '',
      workTypeId: ['', '  '],
      dateFrom: '',
      dateTo: '   ',
      skill: '',
    });
    expect(out.skillMine).toBe(false);
    expect(out.projectId).toBeUndefined();
    expect(out.areaIds).toBeUndefined();
    expect(out.dateFrom).toBeUndefined();
  });

  it.each([
    ['2026-10-01T00:00:00Z'],
    ['2026-10-01T00:00:00+07:00'],
    ['2026-10-01T00:00:00+0700'],
    ['2026-10-01T00:00:00.123z'],
    ['2026-10-01T00:00:00-05:00'],
  ])('date %s (có offset) → parse instant', (iso) => {
    const out = parseJobBoardFilters({ dateFrom: iso });
    expect(out.dateFrom).toEqual(new Date(iso));
  });

  it.each([
    ['2026-10-01T00:00:00', 'dateFrom'],
    ['2026-10-01', 'dateFrom'],
    ['2026-10-01 00:00:00', 'dateTo'],
    [123, 'dateFrom'],
    [true, 'dateTo'],
  ])('naive/non-string %s → JobBoardFilterError đúng field', (value, field) => {
    const raw = field === 'dateFrom' ? { dateFrom: value } : { dateTo: value };
    try {
      parseJobBoardFilters(raw);
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(JobBoardFilterError);
      expect((e as JobBoardFilterError).fields).toEqual([field]);
      // F001 (#46): date errors mang code JOB_BOARD_DATE_RANGE_INVALID.
      expect((e as JobBoardFilterError).code).toBe('JOB_BOARD_DATE_RANGE_INVALID');
    }
  });

  it('dateFrom > dateTo (instant) → lỗi CẢ hai field', () => {
    try {
      parseJobBoardFilters({
        dateFrom: '2026-10-05T00:00:00Z',
        dateTo: '2026-10-01T00:00:00Z',
      });
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(JobBoardFilterError);
      expect((e as JobBoardFilterError).fields).toEqual(['dateFrom', 'dateTo']);
      expect((e as JobBoardFilterError).code).toBe('JOB_BOARD_DATE_RANGE_INVALID');
    }
  });

  it('dateFrom == dateTo → hợp lệ (khoảng 1 instant)', () => {
    const out = parseJobBoardFilters({
      dateFrom: '2026-10-01T00:00:00Z',
      dateTo: '2026-10-01T00:00:00Z',
    });
    expect(out.dateFrom?.getTime()).toBe(out.dateTo?.getTime());
  });

  it('projectId uuid hợp lệ → trim; sai format → lỗi {projectId}', () => {
    expect(parseJobBoardFilters({ projectId: ` ${UUID} ` }).projectId).toBe(UUID);
    expect(() => parseJobBoardFilters({ projectId: 'not-a-uuid' })).toThrow(
      expect.objectContaining({ fields: ['projectId'] }),
    );
  });

  it('areaId/workTypeId lặp được: đơn + mảng + dedupe; phần tử sai → lỗi đúng field', () => {
    expect(parseJobBoardFilters({ areaId: UUID }).areaIds).toEqual([UUID]);
    expect(parseJobBoardFilters({ areaId: [UUID, UUID2, UUID] }).areaIds).toEqual([UUID, UUID2]);
    expect(parseJobBoardFilters({ workTypeId: [UUID, ''] }).workTypeIds).toEqual([UUID]);
    expect(() => parseJobBoardFilters({ areaId: [UUID, 'nope'] })).toThrow(
      expect.objectContaining({ fields: ['areaId'] }),
    );
    expect(() => parseJobBoardFilters({ workTypeId: 'nope' })).toThrow(
      expect.objectContaining({ fields: ['workTypeId'] }),
    );
  });

  it(`skill=mine → true; giá trị khác → lỗi {skill}`, () => {
    expect(parseJobBoardFilters({ skill: 'mine' }).skillMine).toBe(true);
    expect(() => parseJobBoardFilters({ skill: 'all' })).toThrow(
      expect.objectContaining({ fields: ['skill'] }),
    );
    expect(() => parseJobBoardFilters({ skill: 'MINE' })).toThrow(
      expect.objectContaining({ fields: ['skill'] }),
    );
  });

  it('Date instance được miễn check offset', () => {
    const d = new Date('2026-10-01T00:00:00.000Z');
    expect(parseJobBoardFilters({ dateFrom: d }).dateFrom).toBe(d);
  });
});
