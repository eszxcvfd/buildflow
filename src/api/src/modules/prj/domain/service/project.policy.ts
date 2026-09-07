/**
 * PRJ-SRS-001 (issue #32) — validation helpers thuần domain cho dự án
 * (mirror crew-member.policy style: không Nest/DB, ném Error, use case
 * convert sang 400 fieldErrors).
 */

export const PROJECT_CODE_RE = /^[A-Za-z0-9_-]+$/;
export const PROJECT_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CLOSED'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const DEFAULT_PROJECT_TIMEZONE = 'Asia/Ho_Chi_Minh';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` hợp lệ trên lịch (loại `2026-02-30`, `2026-13-01`). */
export function isValidIsoDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Mã dự án: bắt buộc, 2-50 ký tự, `^[A-Za-z0-9_-]+$`. */
export function normalizeProjectCode(code: unknown): string {
  const trimmed = String(code ?? '').trim();
  if (trimmed.length === 0) throw new Error('Mã dự án không được để trống');
  if (trimmed.length < 2 || trimmed.length > 50) throw new Error('Mã dự án phải từ 2 đến 50 ký tự');
  if (!PROJECT_CODE_RE.test(trimmed)) throw new Error('Mã dự án chỉ cho phép chữ, số, _ và -');
  return trimmed;
}

/** Tên dự án: bắt buộc, 1-200 ký tự. */
export function normalizeProjectName(name: unknown): string {
  const trimmed = String(name ?? '').trim();
  if (trimmed.length === 0) throw new Error('Tên dự án không được để trống');
  if (trimmed.length > 200) throw new Error('Tên dự án tối đa 200 ký tự');
  return trimmed;
}

/** Địa chỉ: bắt buộc, 1-500 ký tự. */
export function normalizeProjectAddress(address: unknown): string {
  const trimmed = String(address ?? '').trim();
  if (trimmed.length === 0) throw new Error('Địa chỉ dự án không được để trống');
  if (trimmed.length > 500) throw new Error('Địa chỉ dự án tối đa 500 ký tự');
  return trimmed;
}

/** Mô tả: optional, ≤2000 ký tự. Trả null khi không gửi/rỗng. */
export function normalizeProjectDescription(description?: string | null): string | null {
  if (description === undefined || description === null) return null;
  const trimmed = String(description).trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 2000) throw new Error('Mô tả dự án tối đa 2000 ký tự');
  return trimmed;
}

/** Timezone: optional ≤64 ký tự, default `Asia/Ho_Chi_Minh`. */
export function normalizeProjectTimezone(timezone?: string | null): string {
  if (timezone === undefined || timezone === null || String(timezone).trim().length === 0) {
    return DEFAULT_PROJECT_TIMEZONE;
  }
  const trimmed = String(timezone).trim();
  if (trimmed.length > 64) throw new Error('Múi giờ tối đa 64 ký tự');
  return trimmed;
}

/**
 * Ngày kế hoạch: bắt buộc, ISO date `YYYY-MM-DD` hợp lệ lịch,
 * `plannedEndDate >= plannedStartDate`. Ném Error khi vi phạm.
 */
export function assertPlannedDates(start: unknown, end: unknown): void {
  const s = String(start ?? '').trim();
  const e = String(end ?? '').trim();
  if (!isValidIsoDateString(s)) throw new Error('Ngày bắt đầu kế hoạch không hợp lệ (YYYY-MM-DD)');
  if (!isValidIsoDateString(e)) throw new Error('Ngày kết thúc kế hoạch không hợp lệ (YYYY-MM-DD)');
  if (e < s) throw new Error('Ngày kết thúc kế hoạch phải từ ngày bắt đầu trở đi');
}

/* ------------------------------------------------------------------ */
/* PRJ-SRS-002 (issue #33) — lifecycle trạng thái dự án (L1-L6).        */
/* Pure transition map + reason policy (mirror org resource-status      */
/* policy shape: transition map, reason mandatory, alreadyInState).     */
/* ------------------------------------------------------------------ */

/** Action lifecycle ở API layer (L1). */
export const PROJECT_STATUS_ACTIONS = [
  'ACTIVATE',
  'PAUSE',
  'RESUME',
  'COMPLETE',
  'CLOSE',
  'REOPEN',
] as const;
export type ProjectStatusAction = (typeof PROJECT_STATUS_ACTIONS)[number];

export function isProjectStatusAction(value: string): value is ProjectStatusAction {
  return (PROJECT_STATUS_ACTIONS as readonly string[]).includes(value);
}

/**
 * Transition map L1 (duy nhất được phép):
 *   DRAFT → ACTIVE (ACTIVATE); DRAFT → CLOSED (CLOSE, hủy nháp)
 *   ACTIVE → PAUSED (PAUSE); ACTIVE → COMPLETED (COMPLETE)
 *   PAUSED → ACTIVE (RESUME)
 *   COMPLETED → CLOSED (CLOSE)
 *   CLOSED → ACTIVE (REOPEN)
 */
const PROJECT_TRANSITIONS: Record<ProjectStatus, Partial<Record<ProjectStatusAction, ProjectStatus>>> = {
  DRAFT: { ACTIVATE: 'ACTIVE', CLOSE: 'CLOSED' },
  ACTIVE: { PAUSE: 'PAUSED', COMPLETE: 'COMPLETED' },
  PAUSED: { RESUME: 'ACTIVE' },
  COMPLETED: { CLOSE: 'CLOSED' },
  CLOSED: { REOPEN: 'ACTIVE' },
};

/** Trạng thái đích của action từ trạng thái hiện tại; null = chuyển đổi không hợp lệ. */
export function targetStatusForProjectAction(
  from: ProjectStatus,
  action: ProjectStatusAction,
): ProjectStatus | null {
  return PROJECT_TRANSITIONS[from][action] ?? null;
}

/** Các action hợp lệ từ trạng thái hiện tại (dùng cho 409 `allowedTransitions`). */
export function allowedActionsFor(status: ProjectStatus): ProjectStatusAction[] {
  return Object.keys(PROJECT_TRANSITIONS[status]) as ProjectStatusAction[];
}

/** Đích có nằm trong transition map từ trạng thái hiện tại không (entity `changeStatus` dùng). */
export function isAllowedProjectTransition(from: ProjectStatus, target: ProjectStatus): boolean {
  return (Object.values(PROJECT_TRANSITIONS[from]) as ProjectStatus[]).includes(target);
}

/** Trạng thái đích mà mỗi action nhắm tới (dùng cho idempotent alreadyInState, L3). */
const PROJECT_ACTION_TARGET: Record<ProjectStatusAction, ProjectStatus> = {
  ACTIVATE: 'ACTIVE',
  PAUSE: 'PAUSED',
  RESUME: 'ACTIVE',
  COMPLETE: 'COMPLETED',
  CLOSE: 'CLOSED',
  REOPEN: 'ACTIVE',
};

/** Action nhắm đúng trạng thái hiện tại → 200 `{alreadyInState: true}`, không mutation (L3). */
export function isAlreadyInProjectState(status: ProjectStatus, action: ProjectStatusAction): boolean {
  return PROJECT_ACTION_TARGET[action] === status;
}

/**
 * Reason policy L1: bắt buộc (1-500 ký tự, sau trim) cho PAUSE (tạm dừng),
 * CLOSE (đóng/hủy nháp) và REOPEN (mở lại — cần quyền + lý do per SRS);
 * optional cho ACTIVATE/RESUME/COMPLETE.
 */
export const PROJECT_REASON_REQUIRED_MESSAGE =
  'Lý do là bắt buộc khi tạm dừng/đóng/mở lại dự án';

export const PROJECT_REASON_MAX_LENGTH = 500;

export function isReasonRequiredForProjectAction(action: ProjectStatusAction): boolean {
  return action === 'PAUSE' || action === 'CLOSE' || action === 'REOPEN';
}

/** Chuẩn hóa reason: trim; null khi trống/thiếu; quá dài → throw (use case convert 400 fieldErrors). */
export function normalizeProjectStatusReason(reason?: string | null): string | null {
  if (reason === undefined || reason === null || reason === '') return null;
  const trimmed = String(reason).trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > PROJECT_REASON_MAX_LENGTH) {
    throw new Error(`Lý do tối đa ${PROJECT_REASON_MAX_LENGTH} ký tự`);
  }
  return trimmed;
}
