import {
  JobBoardWindowError,
  classifyCloseFailure,
  classifyOpenFailure,
  deriveJobBoardState,
  isOpenableStatus,
  isSameJobBoardWindow,
  validateJobBoardWindow,
} from './work-order-job-board.policy';

const NOW = new Date('2026-10-15T08:00:00.000Z');

describe('work-order-job-board.policy (JOB-SRS-004)', () => {
  describe('validateJobBoardWindow', () => {
    it('from absent → default now; until absent → null', () => {
      const out = validateJobBoardWindow({ now: NOW });
      expect(out.from.getTime()).toBe(NOW.getTime());
      expect(out.until).toBeNull();
    });

    it('until null tường minh = không hạn', () => {
      const out = validateJobBoardWindow({
        jobBoardOpenFrom: '2026-10-15T08:00:00.000Z',
        jobBoardOpenUntil: null,
        now: NOW,
      });
      expect(out.until).toBeNull();
    });

    it('cửa sổ hợp lệ (ISO có offset → instant UTC)', () => {
      const out = validateJobBoardWindow({
        jobBoardOpenFrom: '2026-10-15T15:00:00+07:00',
        jobBoardOpenUntil: '2026-10-20T15:00:00+07:00',
        now: NOW,
      });
      expect(out.from.toISOString()).toBe('2026-10-15T08:00:00.000Z');
      expect(out.until?.toISOString()).toBe('2026-10-20T08:00:00.000Z');
    });

    it('F004: ISO thiếu offset (naive datetime-local, date-only) → 400 field đúng', () => {
      for (const [input, field] of [
        [{ jobBoardOpenFrom: '2026-10-06T08:00', now: NOW }, 'jobBoardOpenFrom'],
        [{ jobBoardOpenFrom: '2026-10-15', now: NOW }, 'jobBoardOpenFrom'],
        [
          { jobBoardOpenFrom: '2026-10-15T08:00:00.000Z', jobBoardOpenUntil: '2026-10-20T08:00', now: NOW },
          'jobBoardOpenUntil',
        ],
      ] as const) {
        try {
          validateJobBoardWindow(input);
          fail('phải throw');
        } catch (e) {
          expect(e).toBeInstanceOf(JobBoardWindowError);
          expect((e as JobBoardWindowError).field).toBe(field);
        }
      }
    });

    it('F004: ISO có offset Z / ±hh:mm được chấp nhận (instant UTC đúng)', () => {
      const z = validateJobBoardWindow({
        jobBoardOpenFrom: '2026-10-15T08:00:00.000Z',
        jobBoardOpenUntil: '2026-10-20T08:00:00.000Z',
        now: NOW,
      });
      expect(z.from.toISOString()).toBe('2026-10-15T08:00:00.000Z');
      const plus07 = validateJobBoardWindow({
        jobBoardOpenFrom: '2026-10-15T15:00:00+07:00',
        jobBoardOpenUntil: '2026-10-20T15:00:00+07:00',
        now: NOW,
      });
      expect(plus07.from.toISOString()).toBe('2026-10-15T08:00:00.000Z');
      expect(plus07.until?.toISOString()).toBe('2026-10-20T08:00:00.000Z');
    });

    it('F019: non-string/non-Date (array/number/boolean/object) → 400 field đúng', () => {
      const cases: Array<[unknown, unknown, 'jobBoardOpenFrom' | 'jobBoardOpenUntil']> = [
        [['2026-10-06T08:00'], undefined, 'jobBoardOpenFrom'],
        [2026, undefined, 'jobBoardOpenFrom'],
        [true, undefined, 'jobBoardOpenFrom'],
        [{}, undefined, 'jobBoardOpenFrom'],
        ['2026-10-15T08:00:00.000Z', ['2026-10-20T08:00:00.000Z'], 'jobBoardOpenUntil'],
        ['2026-10-15T08:00:00.000Z', 2026, 'jobBoardOpenUntil'],
        ['2026-10-15T08:00:00.000Z', false, 'jobBoardOpenUntil'],
      ];
      for (const [from, until, field] of cases) {
        try {
          validateJobBoardWindow({ jobBoardOpenFrom: from, jobBoardOpenUntil: until, now: NOW });
          fail(`phải throw: ${JSON.stringify(from)}/${JSON.stringify(until)}`);
        } catch (e) {
          expect(e).toBeInstanceOf(JobBoardWindowError);
          expect((e as JobBoardWindowError).field).toBe(field);
        }
      }
    });

    it('until <= from → 400 {jobBoardOpenUntil}', () => {
      try {
        validateJobBoardWindow({
          jobBoardOpenFrom: '2026-10-20T08:00:00.000Z',
          jobBoardOpenUntil: '2026-10-20T08:00:00.000Z',
          now: NOW,
        });
        fail('phải throw');
      } catch (e) {
        expect(e).toBeInstanceOf(JobBoardWindowError);
        expect((e as JobBoardWindowError).field).toBe('jobBoardOpenUntil');
      }
    });

    it('until quá khứ → 400 {jobBoardOpenUntil}', () => {
      try {
        validateJobBoardWindow({
          jobBoardOpenFrom: '2026-10-01T08:00:00.000Z',
          jobBoardOpenUntil: '2026-10-02T08:00:00.000Z',
          now: NOW,
        });
        fail('phải throw');
      } catch (e) {
        expect((e as JobBoardWindowError).field).toBe('jobBoardOpenUntil');
      }
    });

    it('ISO sai → field đúng', () => {
      try {
        validateJobBoardWindow({ jobBoardOpenFrom: 'không-phải-ngày', now: NOW });
        fail('phải throw');
      } catch (e) {
        expect((e as JobBoardWindowError).field).toBe('jobBoardOpenFrom');
      }
      try {
        validateJobBoardWindow({
          jobBoardOpenFrom: '2026-10-15T08:00:00.000Z',
          jobBoardOpenUntil: 'abc',
          now: NOW,
        });
        fail('phải throw');
      } catch (e) {
        expect((e as JobBoardWindowError).field).toBe('jobBoardOpenUntil');
      }
    });
  });

  describe('deriveJobBoardState', () => {
    const base = {
      status: 'OPEN' as const,
      jobBoardOpen: true,
      jobBoardOpenFrom: new Date('2026-10-10T08:00:00.000Z'),
      jobBoardOpenUntil: new Date('2026-10-20T08:00:00.000Z'),
      hasActiveAssignment: false,
      now: NOW,
    };

    it('AVAILABLE khi board mở + OPEN trong cửa sổ', () => {
      expect(deriveJobBoardState(base)).toBe('AVAILABLE');
    });

    it('EXPIRED khi until đã qua (board vẫn mở)', () => {
      expect(
        deriveJobBoardState({ ...base, jobBoardOpenUntil: new Date('2026-10-12T08:00:00.000Z') }),
      ).toBe('EXPIRED');
    });

    it('SCHEDULED khi from còn tương lai', () => {
      expect(
        deriveJobBoardState({ ...base, jobBoardOpenFrom: new Date('2026-10-18T08:00:00.000Z') }),
      ).toBe('SCHEDULED');
    });

    it('ASSIGNED khi có assignment (kể cả board mở)', () => {
      expect(deriveJobBoardState({ ...base, hasActiveAssignment: true })).toBe('ASSIGNED');
    });

    it('ASSIGNED theo status ASSIGNED/IN_PROGRESS (không cần query)', () => {
      expect(deriveJobBoardState({ ...base, status: 'ASSIGNED', jobBoardOpen: false })).toBe('ASSIGNED');
      expect(deriveJobBoardState({ ...base, status: 'IN_PROGRESS', jobBoardOpen: false })).toBe('ASSIGNED');
    });

    it('CLOSED: board đóng / DRAFT / terminal (CANCELLED/WORK_DONE/CLOSED không thành ASSIGNED)', () => {
      expect(deriveJobBoardState({ ...base, jobBoardOpen: false })).toBe('CLOSED');
      expect(
        deriveJobBoardState({ ...base, status: 'DRAFT', jobBoardOpen: false }),
      ).toBe('CLOSED');
      for (const status of ['CANCELLED', 'WORK_DONE', 'CLOSED'] as const) {
        expect(
          deriveJobBoardState({
            ...base,
            status,
            jobBoardOpen: false,
            jobBoardOpenFrom: null,
            jobBoardOpenUntil: null,
          }),
        ).toBe('CLOSED');
      }
    });
  });

  describe('isOpenableStatus / isSameJobBoardWindow', () => {
    it('chỉ DRAFT/READY/OPEN mở được', () => {
      expect(isOpenableStatus('DRAFT')).toBe(true);
      expect(isOpenableStatus('READY')).toBe(true);
      expect(isOpenableStatus('OPEN')).toBe(true);
      for (const s of ['ASSIGNED', 'IN_PROGRESS', 'WORK_DONE', 'CLOSED', 'CANCELLED'] as const) {
        expect(isOpenableStatus(s)).toBe(false);
      }
    });

    it('F016: so window FULL-MS ở mọi đường — lệch ms dù cùng giây → KHÁC (409)', () => {
      const a = { from: new Date('2026-10-15T08:00:00.100Z'), until: null };
      expect(
        isSameJobBoardWindow(a, { from: new Date('2026-10-15T08:00:00.900Z'), until: null }),
      ).toBe(false);
      expect(
        isSameJobBoardWindow(a, { from: new Date('2026-10-15T08:00:00.100Z'), until: null }),
      ).toBe(true);
      const b = { from: new Date('2026-10-15T08:00:00.999Z'), until: null };
      expect(
        isSameJobBoardWindow(b, { from: new Date('2026-10-15T08:00:01.000Z'), until: null }),
      ).toBe(false);
    });

    it('so window theo instant (null-safe)', () => {
      const a = { from: new Date('2026-10-15T08:00:00.000Z'), until: null };
      expect(isSameJobBoardWindow(a, { from: new Date('2026-10-15T08:00:00.000Z'), until: null })).toBe(true);
      expect(
        isSameJobBoardWindow(a, { from: new Date('2026-10-15T08:00:01.000Z'), until: null }),
      ).toBe(false);
      expect(isSameJobBoardWindow(a, { from: new Date('2026-10-15T08:00:00.000Z'), until: new Date() })).toBe(false);
    });
  });

  describe('classifyOpenFailure / classifyCloseFailure', () => {
    it('open: version → flag → assignment → status', () => {
      expect(
        classifyOpenFailure({ expectedVersion: 1, currentVersion: 2, jobBoardOpen: true, status: 'DRAFT', hasActiveAssignment: true }),
      ).toBe('WORK_ORDER_CONFLICT');
      expect(
        classifyOpenFailure({ expectedVersion: null, currentVersion: 2, jobBoardOpen: true, status: 'DRAFT', hasActiveAssignment: false }),
      ).toBe('JOB_BOARD_ALREADY_OPEN');
      expect(
        classifyOpenFailure({ expectedVersion: null, currentVersion: 2, jobBoardOpen: false, status: 'DRAFT', hasActiveAssignment: true }),
      ).toBe('JOB_BOARD_HAS_ASSIGNEE');
      expect(
        classifyOpenFailure({ expectedVersion: null, currentVersion: 2, jobBoardOpen: false, status: 'CANCELLED', hasActiveAssignment: false }),
      ).toBe('WORK_ORDER_STATUS_NOT_OPENABLE');
    });

    it('close: version → flag → CANCELLED', () => {
      expect(
        classifyCloseFailure({ expectedVersion: 1, currentVersion: 2, jobBoardOpen: true, status: 'OPEN' }),
      ).toBe('WORK_ORDER_CONFLICT');
      expect(
        classifyCloseFailure({ expectedVersion: null, currentVersion: 2, jobBoardOpen: false, status: 'READY' }),
      ).toBe('ALREADY_CLOSED');
      expect(
        classifyCloseFailure({ expectedVersion: null, currentVersion: 2, jobBoardOpen: true, status: 'CANCELLED' }),
      ).toBe('WORK_ORDER_STATUS_NOT_CLOSABLE');
    });
  });
});
