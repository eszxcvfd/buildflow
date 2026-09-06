/**
 * ORG-SRS-007 (issue #30) — policy dùng chung cho quản lý thành viên đội.
 * Domain thuần (không Nest/DB): validate date-only `YYYY-MM-DD`,
 * reason resign/remove và text cảnh báo overlap.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` hợp lệ trên lịch (loại `2026-02-30`, `2026-13-01`). */
export function isValidIsoDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Ngày hiện tại dạng `YYYY-MM-DD` (UTC) — default cho effectiveFrom/effectiveTo. */
export function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Reason remove-member: optional; khi gửi phải 1-500 ký tự sau trim.
 * Trả null khi không gửi. Ném Error khi vi phạm.
 */
export function normalizeMemberReason(reason?: string | null): string | null {
  if (reason === undefined || reason === null) return null;
  const trimmed = String(reason).trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 500) throw new Error('Lý do tối đa 500 ký tự');
  return trimmed;
}

/** Text `_warning` audit khi member đang tham gia đội khác (WARN, không chặn). */
export function memberOverlapWarningText(
  otherCrews: Array<{ crewCode: string; crewName: string }>,
): string {
  const codes = otherCrews.map((c) => c.crewCode).join(', ');
  return `Thành viên đang tham gia đội khác (${codes}), vẫn thêm vào đội`;
}
