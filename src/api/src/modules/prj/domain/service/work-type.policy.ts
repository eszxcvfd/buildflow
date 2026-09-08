/**
 * PRJ-SRS-004 (issue #35) — validation helpers thuần domain cho loại công việc
 * (mirror project-area.policy style: không Nest/DB, ném Error, use case
 * convert sang 400 fieldErrors).
 */

export const WORK_TYPE_CODE_RE = /^[A-Za-z0-9_-]+$/;
export const WORK_TYPE_CODE_MIN_LENGTH = 2;
export const WORK_TYPE_CODE_MAX_LENGTH = 50;
export const WORK_TYPE_NAME_MAX_LENGTH = 150;
export const WORK_TYPE_DESCRIPTION_MAX_LENGTH = 500;
export const WORK_TYPE_GROUP_MAX_LENGTH = 100;
export const WORK_TYPE_REASON_MAX_LENGTH = 500;
export const WORK_TYPE_REQUIRED_FIELDS_MAX = 50;

export type RequiredFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT' | 'PHOTO';

export const REQUIRED_FIELD_TYPES: RequiredFieldType[] = [
  'TEXT',
  'NUMBER',
  'DATE',
  'BOOLEAN',
  'SELECT',
  'PHOTO',
];

export interface RequiredFieldConfig {
  key: string;
  label: string;
  type: RequiredFieldType;
  required?: boolean;
  options?: string[];
}

export type WorkTypePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export const WORK_TYPE_PRIORITIES: WorkTypePriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

/** Mã loại công việc: bắt buộc, 2-50 ký tự, `^[A-Za-z0-9_-]+$` (cùng pattern trades P4). */
export function normalizeWorkTypeCode(code: unknown): string {
  const trimmed = String(code ?? '').trim();
  if (trimmed.length < WORK_TYPE_CODE_MIN_LENGTH || trimmed.length > WORK_TYPE_CODE_MAX_LENGTH) {
    throw new Error(`Mã loại công việc phải từ ${WORK_TYPE_CODE_MIN_LENGTH} đến ${WORK_TYPE_CODE_MAX_LENGTH} ký tự`);
  }
  if (!WORK_TYPE_CODE_RE.test(trimmed)) {
    throw new Error('Mã loại công việc chỉ cho phép chữ, số, _ và -');
  }
  return trimmed;
}

/** Tên loại công việc: bắt buộc, 1-150 ký tự sau trim. */
export function normalizeWorkTypeName(name: unknown): string {
  const trimmed = String(name ?? '').trim();
  if (trimmed.length === 0) throw new Error('Tên loại công việc không được để trống');
  if (trimmed.length > WORK_TYPE_NAME_MAX_LENGTH) {
    throw new Error(`Tên loại công việc tối đa ${WORK_TYPE_NAME_MAX_LENGTH} ký tự`);
  }
  return trimmed;
}

/** Mô tả: optional; rỗng → null; tối đa 500 ký tự. */
export function normalizeWorkTypeDescription(description?: string | null): string | null {
  if (description === undefined || description === null) return null;
  const trimmed = String(description).trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > WORK_TYPE_DESCRIPTION_MAX_LENGTH) {
    throw new Error(`Mô tả loại công việc tối đa ${WORK_TYPE_DESCRIPTION_MAX_LENGTH} ký tự`);
  }
  return trimmed;
}

/**
 * Nhóm công việc (`work_type_group`): optional grouping label; rỗng → null;
 * tối đa 100 ký tự. Expose nguyên trạng trong DTO, không có CRUD riêng.
 */
export function normalizeWorkTypeGroup(group?: string | null): string | null {
  if (group === undefined || group === null) return null;
  const trimmed = String(group).trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > WORK_TYPE_GROUP_MAX_LENGTH) {
    throw new Error(`Nhóm công việc tối đa ${WORK_TYPE_GROUP_MAX_LENGTH} ký tự`);
  }
  return trimmed;
}

/** Thời lượng mặc định (phút): optional; khi gửi phải là số nguyên > 0 (mirror CHECK). */
export function normalizeWorkTypeDuration(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error('Thời lượng mặc định phải là số nguyên dương (phút)');
  }
  return num;
}

/** Ưu tiên mặc định: optional, default `NORMAL`; sai enum → Error. */
export function normalizeWorkTypePriority(value: unknown): WorkTypePriority {
  if (value === undefined || value === null) return 'NORMAL';
  if (!WORK_TYPE_PRIORITIES.includes(value as WorkTypePriority)) {
    throw new Error('Ưu tiên mặc định không hợp lệ');
  }
  return value as WorkTypePriority;
}

/** `required_trade_id`: optional; rỗng → null (không yêu cầu skill cụ thể). */
export function normalizeWorkTypeTradeId(tradeId?: string | null): string | null {
  if (tradeId === undefined || tradeId === null) return null;
  const trimmed = String(tradeId).trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}

/** Reason cho update/status: optional; khi gửi phải 1-500 ký tự sau trim. */
export function normalizeWorkTypeReason(reason?: string | null): string | null {
  if (reason === undefined || reason === null) return null;
  const trimmed = String(reason).trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > WORK_TYPE_REASON_MAX_LENGTH) {
    throw new Error(`Lý do tối đa ${WORK_TYPE_REASON_MAX_LENGTH} ký tự`);
  }
  return trimmed;
}

const REQUIRED_FIELD_KEY_RE = /^[A-Za-z0-9_]+$/;

function normalizeRequiredFieldEntry(entry: unknown, index: number): RequiredFieldConfig {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    throw new Error(`Dữ liệu bắt buộc #${index + 1} phải có dạng {key,label,type}`);
  }
  const raw = entry as Record<string, unknown>;
  const key = String(raw['key'] ?? '').trim();
  if (key.length === 0 || key.length > 50 || !REQUIRED_FIELD_KEY_RE.test(key)) {
    throw new Error(`Dữ liệu bắt buộc #${index + 1}: key phải 1-50 ký tự, chỉ chữ/số/_`);
  }
  const label = String(raw['label'] ?? '').trim();
  if (label.length === 0 || label.length > 120) {
    throw new Error(`Dữ liệu bắt buộc #${index + 1}: label phải 1-120 ký tự`);
  }
  const type = String(raw['type'] ?? '').trim().toUpperCase();
  if (!REQUIRED_FIELD_TYPES.includes(type as RequiredFieldType)) {
    throw new Error(
      `Dữ liệu bắt buộc #${index + 1}: type phải thuộc ${REQUIRED_FIELD_TYPES.join('/')}`,
    );
  }
  const normalized: RequiredFieldConfig = {
    key,
    label,
    type: type as RequiredFieldType,
  };
  if (raw['required'] !== undefined) {
    if (typeof raw['required'] !== 'boolean') {
      throw new Error(`Dữ liệu bắt buộc #${index + 1}: required phải là boolean`);
    }
    normalized.required = raw['required'];
  }
  if (raw['options'] !== undefined) {
    if (!Array.isArray(raw['options'])) {
      throw new Error(`Dữ liệu bắt buộc #${index + 1}: options phải là mảng chuỗi`);
    }
    const options = raw['options'].map((o) => String(o).trim()).filter((o) => o.length > 0);
    if (options.some((o) => o.length > 100)) {
      throw new Error(`Dữ liệu bắt buộc #${index + 1}: mỗi option tối đa 100 ký tự`);
    }
    if (options.length > 20) {
      throw new Error(`Dữ liệu bắt buộc #${index + 1}: tối đa 20 options`);
    }
    normalized.options = options;
  }
  if (normalized.type === 'SELECT' && (!normalized.options || normalized.options.length === 0)) {
    throw new Error(`Dữ liệu bắt buộc #${index + 1}: type SELECT cần ít nhất 1 option`);
  }
  if (normalized.type !== 'SELECT' && normalized.options && normalized.options.length > 0) {
    throw new Error(`Dữ liệu bắt buộc #${index + 1}: options chỉ dùng cho type SELECT`);
  }
  return normalized;
}

/**
 * Danh sách dữ liệu bắt buộc (`required_fields`): optional, default `[]`;
 * mỗi entry phải đúng shape `{key,label,type}` (+ `required?`/`options?`).
 * Trùng `key` (case-insensitive) → Error. Tối đa 50 entries.
 */
export function normalizeRequiredFields(value: unknown): RequiredFieldConfig[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new Error('Danh sách dữ liệu bắt buộc phải là mảng');
  }
  if (value.length > WORK_TYPE_REQUIRED_FIELDS_MAX) {
    throw new Error(`Danh sách dữ liệu bắt buộc tối đa ${WORK_TYPE_REQUIRED_FIELDS_MAX} mục`);
  }
  const normalized = value.map((entry, index) => normalizeRequiredFieldEntry(entry, index));
  const seen = new Set<string>();
  for (const entry of normalized) {
    const lowered = entry.key.toLowerCase();
    if (seen.has(lowered)) {
      throw new Error(`Dữ liệu bắt buộc trùng key: ${entry.key}`);
    }
    seen.add(lowered);
  }
  return normalized;
}
