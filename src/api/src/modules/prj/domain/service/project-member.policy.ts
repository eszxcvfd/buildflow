/**
 * PRJ-SRS-005 (issue #36, M1-M6) — policy dùng chung cho quản lý thành viên dự án.
 * Domain thuần (không Nest/DB, mirror crew-member.policy style): ném Error,
 * use case convert sang 400 fieldErrors.
 */

/** Roles được phép gán qua `POST /projects/:id/members` (M1 — không `MANAGER`). */
export const ADDABLE_PROJECT_MEMBER_ROLES = ['COORDINATOR', 'QC', 'WORKER', 'VIEWER'] as const;
export type AddableProjectMemberRole = (typeof ADDABLE_PROJECT_MEMBER_ROLES)[number];

export function isAddableProjectMemberRole(value: string): value is AddableProjectMemberRole {
  return (ADDABLE_PROJECT_MEMBER_ROLES as readonly string[]).includes(value);
}

export const MANAGER_VIA_PATCH_MESSAGE =
  'Quản lý dự án chỉ đặt qua PATCH /projects/:id managerId';

/**
 * Chuẩn hóa `projectRole` cho POST add-member (M1/M3).
 * - `'MANAGER'` → throw message MANAGER_VIA_PATCH (400 fieldErrors `{projectRole}`).
 * - Role lạ → throw 'Vai trò thành viên không hợp lệ'.
 */
export function normalizeProjectMemberRole(role: unknown): AddableProjectMemberRole {
  const value = String(role ?? '').trim();
  if (value === 'MANAGER') throw new Error(MANAGER_VIA_PATCH_MESSAGE);
  if (!isAddableProjectMemberRole(value)) throw new Error('Vai trò thành viên không hợp lệ');
  return value;
}

/**
 * Reason remove-member (M1): optional; khi gửi phải 1-500 ký tự sau trim.
 * Trả null khi không gửi. Ném Error khi vi phạm (mirror crew-member.policy).
 */
export function normalizeProjectMemberReason(reason?: string | null): string | null {
  if (reason === undefined || reason === null) return null;
  const trimmed = String(reason).trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 500) throw new Error('Lý do tối đa 500 ký tự');
  return trimmed;
}
