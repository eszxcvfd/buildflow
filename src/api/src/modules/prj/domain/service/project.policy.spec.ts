import {
  assertPlannedDates,
  isValidIsoDateString,
  normalizeProjectAddress,
  normalizeProjectCode,
  normalizeProjectDescription,
  normalizeProjectName,
  normalizeProjectTimezone,
  allowedActionsFor,
  isAlreadyInProjectState,
  isProjectStatusAction,
  isReasonRequiredForProjectAction,
  normalizeProjectStatusReason,
  targetStatusForProjectAction,
  PROJECT_STATUS_ACTIONS,
} from './project.policy';

describe('project.policy PRJ-SRS-001 (issue #32)', () => {
  it('isValidIsoDateString: loại ngày không tồn tại trên lịch', () => {
    expect(isValidIsoDateString('2026-09-07')).toBe(true);
    expect(isValidIsoDateString('2026-02-30')).toBe(false);
    expect(isValidIsoDateString('2026-13-01')).toBe(false);
    expect(isValidIsoDateString('07/09/2026')).toBe(false);
    expect(isValidIsoDateString('2026-9-7')).toBe(false);
  });

  it('normalizeProjectCode: 2-50 + ^[A-Za-z0-9_-]+$', () => {
    expect(normalizeProjectCode(' PRJ-001 ')).toBe('PRJ-001');
    expect(() => normalizeProjectCode('A')).toThrow(/2 đến 50/);
    expect(() => normalizeProjectCode('x'.repeat(51))).toThrow(/2 đến 50/);
    expect(() => normalizeProjectCode('PRJ 001')).toThrow(/chữ, số/);
  });

  it('normalizeProjectName/Address: required + giới hạn độ dài', () => {
    expect(() => normalizeProjectName('')).toThrow(/Tên dự án/);
    expect(() => normalizeProjectName('x'.repeat(201))).toThrow(/200/);
    expect(() => normalizeProjectAddress('')).toThrow(/Địa chỉ/);
    expect(() => normalizeProjectAddress('x'.repeat(501))).toThrow(/500/);
  });

  it('normalizeProjectDescription: optional ≤2000, rỗng → null', () => {
    expect(normalizeProjectDescription(undefined)).toBeNull();
    expect(normalizeProjectDescription('   ')).toBeNull();
    expect(() => normalizeProjectDescription('x'.repeat(2001))).toThrow(/2000/);
  });

  it('normalizeProjectTimezone: default Asia/Ho_Chi_Minh, ≤64', () => {
    expect(normalizeProjectTimezone(undefined)).toBe('Asia/Ho_Chi_Minh');
    expect(normalizeProjectTimezone('')).toBe('Asia/Ho_Chi_Minh');
    expect(() => normalizeProjectTimezone('x'.repeat(65))).toThrow(/64/);
  });

  it('assertPlannedDates: required ISO + end >= start', () => {
    expect(() => assertPlannedDates('2026-09-01', '2026-09-01')).not.toThrow();
    expect(() => assertPlannedDates('2026-09-02', '2026-09-01')).toThrow(/từ ngày bắt đầu/);
    expect(() => assertPlannedDates('not-a-date', '2026-09-01')).toThrow(/bắt đầu/);
    expect(() => assertPlannedDates('2026-09-01', '')).toThrow(/kết thúc/);
  });
});

describe('project status policy PRJ-SRS-002 (issue #33, L1/L3)', () => {
  it('isProjectStatusAction: đúng 6 action L1', () => {
    expect(PROJECT_STATUS_ACTIONS).toHaveLength(6);
    for (const a of ['ACTIVATE', 'PAUSE', 'RESUME', 'COMPLETE', 'CLOSE', 'REOPEN']) {
      expect(isProjectStatusAction(a)).toBe(true);
    }
    expect(isProjectStatusAction('SUSPEND')).toBe(false);
    expect(isProjectStatusAction('DELETE')).toBe(false);
    expect(isProjectStatusAction('')).toBe(false);
  });

  it('transition map L1: 7 chuyển đổi hợp lệ', () => {
    expect(targetStatusForProjectAction('DRAFT', 'ACTIVATE')).toBe('ACTIVE');
    expect(targetStatusForProjectAction('DRAFT', 'CLOSE')).toBe('CLOSED');
    expect(targetStatusForProjectAction('ACTIVE', 'PAUSE')).toBe('PAUSED');
    expect(targetStatusForProjectAction('ACTIVE', 'COMPLETE')).toBe('COMPLETED');
    expect(targetStatusForProjectAction('PAUSED', 'RESUME')).toBe('ACTIVE');
    expect(targetStatusForProjectAction('COMPLETED', 'CLOSE')).toBe('CLOSED');
    expect(targetStatusForProjectAction('CLOSED', 'REOPEN')).toBe('ACTIVE');
  });

  it('invalid jumps → null (full matrix còn lại)', () => {
    const invalid: Array<[Parameters<typeof targetStatusForProjectAction>[0], Parameters<typeof targetStatusForProjectAction>[1]]> = [
      ['DRAFT', 'PAUSE'],
      ['DRAFT', 'RESUME'],
      ['DRAFT', 'COMPLETE'],
      ['DRAFT', 'REOPEN'],
      ['ACTIVE', 'ACTIVATE'],
      ['ACTIVE', 'RESUME'],
      ['ACTIVE', 'REOPEN'],
      ['ACTIVE', 'CLOSE'],
      ['PAUSED', 'PAUSE'],
      ['PAUSED', 'ACTIVATE'],
      ['PAUSED', 'COMPLETE'],
      ['PAUSED', 'CLOSE'],
      ['PAUSED', 'REOPEN'],
      ['COMPLETED', 'COMPLETE'],
      ['COMPLETED', 'ACTIVATE'],
      ['COMPLETED', 'PAUSE'],
      ['COMPLETED', 'RESUME'],
      ['COMPLETED', 'REOPEN'],
      ['CLOSED', 'CLOSE'],
      ['CLOSED', 'PAUSE'],
      ['CLOSED', 'COMPLETE'],
      ['CLOSED', 'ACTIVATE'],
      ['CLOSED', 'RESUME'],
    ];
    for (const [from, action] of invalid) {
      expect(targetStatusForProjectAction(from, action)).toBeNull();
    }
  });

  it('allowedActionsFor: danh sách action cho 409 allowedTransitions', () => {
    expect(allowedActionsFor('DRAFT')).toEqual(['ACTIVATE', 'CLOSE']);
    expect(allowedActionsFor('ACTIVE')).toEqual(['PAUSE', 'COMPLETE']);
    expect(allowedActionsFor('PAUSED')).toEqual(['RESUME']);
    expect(allowedActionsFor('COMPLETED')).toEqual(['CLOSE']);
    expect(allowedActionsFor('CLOSED')).toEqual(['REOPEN']);
  });

  it('isAlreadyInProjectState L3: action nhắm đúng trạng thái hiện tại', () => {
    expect(isAlreadyInProjectState('ACTIVE', 'ACTIVATE')).toBe(true);
    expect(isAlreadyInProjectState('ACTIVE', 'RESUME')).toBe(true);
    expect(isAlreadyInProjectState('ACTIVE', 'REOPEN')).toBe(true);
    expect(isAlreadyInProjectState('PAUSED', 'PAUSE')).toBe(true);
    expect(isAlreadyInProjectState('COMPLETED', 'COMPLETE')).toBe(true);
    expect(isAlreadyInProjectState('CLOSED', 'CLOSE')).toBe(true);
    expect(isAlreadyInProjectState('DRAFT', 'ACTIVATE')).toBe(false);
    expect(isAlreadyInProjectState('DRAFT', 'CLOSE')).toBe(false);
    expect(isAlreadyInProjectState('ACTIVE', 'PAUSE')).toBe(false);
  });

  it('reason L1: bắt buộc cho PAUSE/CLOSE/REOPEN, optional cho còn lại', () => {
    expect(isReasonRequiredForProjectAction('PAUSE')).toBe(true);
    expect(isReasonRequiredForProjectAction('CLOSE')).toBe(true);
    expect(isReasonRequiredForProjectAction('REOPEN')).toBe(true);
    expect(isReasonRequiredForProjectAction('ACTIVATE')).toBe(false);
    expect(isReasonRequiredForProjectAction('RESUME')).toBe(false);
    expect(isReasonRequiredForProjectAction('COMPLETE')).toBe(false);
  });

  it('normalizeProjectStatusReason: trim, rỗng → null, >500 throw', () => {
    expect(normalizeProjectStatusReason(undefined)).toBeNull();
    expect(normalizeProjectStatusReason(null)).toBeNull();
    expect(normalizeProjectStatusReason('   ')).toBeNull();
    expect(normalizeProjectStatusReason('  Tạm dừng để chờ  ')).toBe('Tạm dừng để chờ');
    expect(() => normalizeProjectStatusReason('x'.repeat(501))).toThrow(/500/);
    expect(normalizeProjectStatusReason('x'.repeat(500))).toHaveLength(500);
  });
});
