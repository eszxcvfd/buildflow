/**
 * PRJ-SRS-003 (issue #34) — validation phía client cho khu vực/hạng mục.
 *
 * Mirror `project-area.policy.ts` phía API (không import API — web chỉ là
 * consumer qua contract): name bắt buộc 1–150 sau trim; code optional,
 * khi gửi 1–50 `^[A-Za-z0-9_-]+$`; reason optional 1–500 sau trim.
 * Server là authoritative — schema này chỉ chặn lỗi hiển nhiên trước submit.
 */

export interface ProjectAreaFormValues {
  name: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  fieldErrors: Record<string, string[]>;
}

export const PROJECT_AREA_NAME_MAX_LENGTH = 150;
export const PROJECT_AREA_CODE_MAX_LENGTH = 50;
export const PROJECT_AREA_REASON_MAX_LENGTH = 500;

const AREA_CODE_RE = /^[A-Za-z0-9_-]+$/;

/** Validate tên khu vực — trả mảng lỗi (rỗng = hợp lệ). */
export function validateAreaName(name: string): string[] {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return ['Tên khu vực không được để trống'];
  if (trimmed.length > PROJECT_AREA_NAME_MAX_LENGTH) {
    return [`Tên khu vực tối đa ${PROJECT_AREA_NAME_MAX_LENGTH} ký tự`];
  }
  return [];
}

/** Validate mã khu vực (optional — rỗng = không mã, hợp lệ). */
export function validateAreaCode(code: string): string[] {
  const trimmed = (code ?? '').trim();
  if (!trimmed) return [];
  if (trimmed.length > PROJECT_AREA_CODE_MAX_LENGTH) {
    return [`Mã khu vực tối đa ${PROJECT_AREA_CODE_MAX_LENGTH} ký tự`];
  }
  if (!AREA_CODE_RE.test(trimmed)) return ['Mã khu vực chỉ cho phép chữ, số, _ và -'];
  return [];
}

/** Validate lý do (optional — rỗng = không gửi, hợp lệ). */
export function validateAreaReason(reason: string): string[] {
  const trimmed = (reason ?? '').trim();
  if (!trimmed) return [];
  if (trimmed.length > PROJECT_AREA_REASON_MAX_LENGTH) {
    return [`Lý do tối đa ${PROJECT_AREA_REASON_MAX_LENGTH} ký tự`];
  }
  return [];
}

/** Validate form tạo khu vực (name bắt buộc + code optional). */
export function validateProjectAreaCreate(values: ProjectAreaFormValues): ValidationResult {
  const fieldErrors: Record<string, string[]> = {};
  const nameErrors = validateAreaName(values.name);
  if (nameErrors.length) fieldErrors.name = nameErrors;
  const codeErrors = validateAreaCode(values.code);
  if (codeErrors.length) fieldErrors.code = codeErrors;
  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors };
}

/**
 * Validate update từng phần: chỉ validate field được gửi (khác undefined).
 * `code: null` = gỡ mã — hợp lệ, không validate.
 */
export function validateProjectAreaUpdate(values: {
  name?: string;
  code?: string | null;
  reason?: string | null;
}): ValidationResult {
  const fieldErrors: Record<string, string[]> = {};
  if (values.name !== undefined) {
    const errs = validateAreaName(values.name);
    if (errs.length) fieldErrors.name = errs;
  }
  if (values.code !== undefined && values.code !== null) {
    const errs = validateAreaCode(values.code);
    if (errs.length) fieldErrors.code = errs;
  }
  if (values.reason !== undefined && values.reason !== null) {
    const errs = validateAreaReason(values.reason);
    if (errs.length) fieldErrors.reason = errs;
  }
  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors };
}
