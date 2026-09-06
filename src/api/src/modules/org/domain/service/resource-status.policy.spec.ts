import {
  isResourceLifecycleAction,
  targetStatusForAction,
  isDeactivatingAction,
  normalizeLifecycleReason,
  REASON_REQUIRED_MESSAGE,
  openWorkWarningText,
} from './resource-status.policy';

// ORG-SRS-004 (issue #27) — state policy shared vocabulary.
// KHÔNG đổi enum DB: action enum API layer chỉ ánh xạ sang ACTIVE/INACTIVE hiện có.

describe('resource-status.policy ORG-SRS-004 (issue #27)', () => {
  it('action enum chỉ nhận ACTIVATE/SUSPEND/TERMINATE', () => {
    expect(isResourceLifecycleAction('ACTIVATE')).toBe(true);
    expect(isResourceLifecycleAction('SUSPEND')).toBe(true);
    expect(isResourceLifecycleAction('TERMINATE')).toBe(true);
    expect(isResourceLifecycleAction('LOCKED')).toBe(false);
    expect(isResourceLifecycleAction('INACTIVE')).toBe(false);
    expect(isResourceLifecycleAction('')).toBe(false);
  });

  it('mapping action -> status DB: ACTIVATE→ACTIVE, SUSPEND/TERMINATE→INACTIVE (enum DB không đổi)', () => {
    expect(targetStatusForAction('ACTIVATE')).toBe('ACTIVE');
    expect(targetStatusForAction('SUSPEND')).toBe('INACTIVE');
    expect(targetStatusForAction('TERMINATE')).toBe('INACTIVE');
  });

  it('SUSPEND/TERMINATE là deactivating (rời ACTIVE → phải cảnh báo open work); ACTIVATE thì không', () => {
    expect(isDeactivatingAction('SUSPEND')).toBe(true);
    expect(isDeactivatingAction('TERMINATE')).toBe(true);
    expect(isDeactivatingAction('ACTIVATE')).toBe(false);
  });

  it('normalizeLifecycleReason: trim; chuỗi trống/null/undefined → null; quá 500 → throw', () => {
    expect(normalizeLifecycleReason(undefined)).toBeNull();
    expect(normalizeLifecycleReason(null)).toBeNull();
    expect(normalizeLifecycleReason('')).toBeNull();
    expect(normalizeLifecycleReason('   ')).toBeNull();
    expect(normalizeLifecycleReason('  Vi phạm  ')).toBe('Vi phạm');
    expect(() => normalizeLifecycleReason('x'.repeat(501))).toThrow();
    expect(normalizeLifecycleReason('x'.repeat(500))).toBe('x'.repeat(500));
  });

  it('openWorkWarningText format + message REASON_REQUIRED', () => {
    expect(openWorkWarningText(3)).toBe('Nguồn lực đang có 3 công việc/lịch mở');
    expect(openWorkWarningText(1)).toBe('Nguồn lực đang có 1 công việc/lịch mở');
    expect(REASON_REQUIRED_MESSAGE).toBe('Lý do là bắt buộc khi tạm ngừng/chấm dứt');
  });
});
