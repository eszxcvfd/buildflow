/**
 * PRJ-SRS-003 (issue #34) — validation helpers thuần domain cho khu vực
 * dự án (mirror project.policy style: không Nest/DB, ném Error, use case
 * convert sang 400 fieldErrors).
 *
 * Single level: entity/policy không có khái niệm parent — schema cũng không
 * có cột parent_id nên cấp thứ hai không thể tồn tại (xem ENDPOINTS.md §13).
 */

export const PROJECT_AREA_CODE_RE = /^[A-Za-z0-9_-]+$/;
export const PROJECT_AREA_NAME_MAX_LENGTH = 150;
export const PROJECT_AREA_CODE_MAX_LENGTH = 50;
export const PROJECT_AREA_REASON_MAX_LENGTH = 500;

/** Tên khu vực: bắt buộc, 1-150 ký tự sau trim. */
export function normalizeProjectAreaName(name: unknown): string {
  const trimmed = String(name ?? '').trim();
  if (trimmed.length === 0) throw new Error('Tên khu vực không được để trống');
  if (trimmed.length > PROJECT_AREA_NAME_MAX_LENGTH) {
    throw new Error(`Tên khu vực tối đa ${PROJECT_AREA_NAME_MAX_LENGTH} ký tự`);
  }
  return trimmed;
}

/**
 * Mã khu vực: optional. `undefined`/`null`/rỗng → null (không mã).
 * Khi gửi: 1-50 ký tự, `^[A-Za-z0-9_-]+$` (cùng pattern mã dự án P4).
 */
export function normalizeProjectAreaCode(code?: string | null): string | null {
  if (code === undefined || code === null) return null;
  const trimmed = String(code).trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > PROJECT_AREA_CODE_MAX_LENGTH) {
    throw new Error(`Mã khu vực tối đa ${PROJECT_AREA_CODE_MAX_LENGTH} ký tự`);
  }
  if (!PROJECT_AREA_CODE_RE.test(trimmed)) {
    throw new Error('Mã khu vực chỉ cho phép chữ, số, _ và -');
  }
  return trimmed;
}

/**
 * Reason update-area: optional; khi gửi phải 1-500 ký tự sau trim.
 * Trả null khi không gửi. Ghi vào cột `audit_logs.reason` (và `afterData`
 * khi có — xem update use case). Ném Error khi vi phạm.
 */
export function normalizeProjectAreaReason(reason?: string | null): string | null {
  if (reason === undefined || reason === null) return null;
  const trimmed = String(reason).trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > PROJECT_AREA_REASON_MAX_LENGTH) {
    throw new Error(`Lý do tối đa ${PROJECT_AREA_REASON_MAX_LENGTH} ký tự`);
  }
  return trimmed;
}
