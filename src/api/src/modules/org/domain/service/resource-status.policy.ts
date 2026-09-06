// ORG-SRS-004 (issue #27) — shared status-transition vocabulary for workers and
// contractors. State policy (owner-approved, KHÔNG đổi DB status enum):
// ba hành động SRS được biểu diễn ở API layer và ánh xạ về enum DB hiện có:
//   ACTIVATE  -> ACTIVE   (worker: users.status ACTIVE qua changeStatus; contractor: ACTIVE)
//   SUSPEND   -> INACTIVE
//   TERMINATE -> INACTIVE
// Eligibility (ACTIVE-only) không đổi logic.

export type ResourceLifecycleAction = 'ACTIVATE' | 'SUSPEND' | 'TERMINATE';

export const RESOURCE_LIFECYCLE_ACTIONS: readonly ResourceLifecycleAction[] = [
  'ACTIVATE',
  'SUSPEND',
  'TERMINATE',
] as const;

export function isResourceLifecycleAction(value: string): value is ResourceLifecycleAction {
  return (RESOURCE_LIFECYCLE_ACTIONS as readonly string[]).includes(value);
}

/** SUSPEND/TERMINATE cùng nhắm trạng thái INACTIVE trong DB (không đổi enum). */
export function targetStatusForAction(action: ResourceLifecycleAction): 'ACTIVE' | 'INACTIVE' {
  return action === 'ACTIVATE' ? 'ACTIVE' : 'INACTIVE';
}

/** Hành động rời khỏi ACTIVE — là nhánh phải cảnh báo open work (không chặn). */
export function isDeactivatingAction(action: ResourceLifecycleAction): boolean {
  return action === 'SUSPEND' || action === 'TERMINATE';
}

/** Reason policy: bắt buộc (1-500 ký tự) khi tạm ngừng/chấm dứt; optional khi kích hoạt. */
export const REASON_REQUIRED_MESSAGE = 'Lý do là bắt buộc khi tạm ngừng/chấm dứt';

export const REASON_MAX_LENGTH = 500;

export function reasonErrorMessage(): string {
  return `Lý do tối đa ${REASON_MAX_LENGTH} ký tự`;
}

/**
 * Cảnh báo open work (SRS: cảnh báo, không chặn). Dùng cho response `warning`
 * và audit afterData `_warning` — text tiếng Việt hợp lệ với
 * `AuditLogEntity.isSanitized()` (pattern `_warning` đã dùng cho contractor/trade).
 */
export function openWorkWarningText(openAssignments: number): string {
  return `Nguồn lực đang có ${openAssignments} công việc/lịch mở`;
}

/** Chuẩn hóa reason theo policy: trim; null khi trống/thiếu; quá dài → throw. */
export function normalizeLifecycleReason(reason?: string | null): string | null {
  if (reason === undefined || reason === null || reason === '') return null;
  const trimmed = reason.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > REASON_MAX_LENGTH) throw new Error(reasonErrorMessage());
  return trimmed;
}
