/**
 * ORG-SRS-007 (issue #30) — policy dùng chung cho quản lý thành viên đội:
 * date-only validation, reason normalize, overlap warning text.
 */
import {
  isValidIsoDateString,
  todayDateOnly,
  normalizeMemberReason,
  memberOverlapWarningText,
} from './crew-member.policy';

describe('crew-member.policy ORG-SRS-007 (issue #30)', () => {
  it('isValidIsoDateString chấp nhận ngày lịch hợp lệ, loại ngày không tồn tại', () => {
    expect(isValidIsoDateString('2026-09-06')).toBe(true);
    expect(isValidIsoDateString('2026-02-30')).toBe(false);
    expect(isValidIsoDateString('2026-13-01')).toBe(false);
    expect(isValidIsoDateString('06-09-2026')).toBe(false);
    expect(isValidIsoDateString('2026-09-06T00:00:00Z')).toBe(false);
    expect(isValidIsoDateString('')).toBe(false);
  });

  it('todayDateOnly trả YYYY-MM-DD', () => {
    expect(todayDateOnly()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('normalizeMemberReason: null khi không gửi/rỗng, lỗi khi >500', () => {
    expect(normalizeMemberReason(undefined)).toBeNull();
    expect(normalizeMemberReason(null)).toBeNull();
    expect(normalizeMemberReason('   ')).toBeNull();
    expect(normalizeMemberReason('Nghỉ việc')).toBe('Nghỉ việc');
    expect(() => normalizeMemberReason('x'.repeat(501))).toThrow('Lý do tối đa 500 ký tự');
  });

  it('memberOverlapWarningText liệt kê mã đội khác', () => {
    const text = memberOverlapWarningText([{ crewCode: 'CREW-A', crewName: 'A' }]);
    expect(text).toContain('CREW-A');
  });
});
