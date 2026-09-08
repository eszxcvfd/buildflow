import type { RequiredField } from '@/lib/api/work-types';

export interface WorkTypeFormValues {
  code: string;
  name: string;
  description: string;
  group: string;
  requiredTradeId: string;
  requiredFields: RequiredField[];
  /** Giá trị thô từ ô nhập (chuỗi); rỗng = không đặt. */
  defaultDurationMinutes?: string | number | null;
  defaultPriority?: string;
}

export interface ValidationResult {
  valid: boolean;
  fieldErrors: Record<string, string[]>;
}

const CODE_RE = /^[A-Za-z0-9_-]+$/;
const KEY_RE = /^[A-Za-z0-9_]+$/;

export const REQUIRED_FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'PHOTO'] as const;

export const REQUIRED_FIELD_TYPE_LABELS: Record<string, string> = {
  TEXT: 'Văn bản',
  NUMBER: 'Số',
  DATE: 'Ngày',
  BOOLEAN: 'Có/Không',
  SELECT: 'Chọn một',
  PHOTO: 'Ảnh',
};

export const WORK_TYPE_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export type WorkTypePriorityValue = (typeof WORK_TYPE_PRIORITIES)[number];

export const WORK_TYPE_PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Thấp',
  NORMAL: 'Thường',
  HIGH: 'Cao',
  URGENT: 'Khẩn cấp',
};

export function validateDurationMinutes(value: string | number | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (!/^\d+$/.test(text)) return 'Thời lượng mặc định phải là số nguyên dương (phút)';
  if (Number(text) < 1) return 'Thời lượng mặc định phải lớn hơn 0 (phút)';
  return null;
}

export function validatePriority(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const text = value.trim();
  if (!text) return null;
  if (!(WORK_TYPE_PRIORITIES as readonly string[]).includes(text)) {
    return 'Ưu tiên mặc định không hợp lệ (LOW/NORMAL/HIGH/URGENT)';
  }
  return null;
}

export function validateRequiredFields(fields: RequiredField[]): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  const seen = new Map<string, number>();
  fields.forEach((f, i) => {
    const prefix = `Dòng ${i + 1}`;
    if (!f.key.trim()) {
      fieldErrors.requiredFields = [...(fieldErrors.requiredFields ?? []), `${prefix}: key không được để trống`];
    } else if (f.key.trim().length > 50) {
      fieldErrors.requiredFields = [...(fieldErrors.requiredFields ?? []), `${prefix}: key tối đa 50 ký tự`];
    } else if (!KEY_RE.test(f.key.trim())) {
      fieldErrors.requiredFields = [...(fieldErrors.requiredFields ?? []), `${prefix}: key chỉ cho phép chữ, số và _`];
    } else {
      const lower = f.key.trim().toLowerCase();
      if (seen.has(lower)) {
        fieldErrors.requiredFields = [
          ...(fieldErrors.requiredFields ?? []),
          `${prefix}: key “${f.key.trim()}” bị trùng với dòng ${seen.get(lower)! + 1}`,
        ];
      } else {
        seen.set(lower, i);
      }
    }
    if (!f.label.trim()) {
      fieldErrors.requiredFields = [...(fieldErrors.requiredFields ?? []), `${prefix}: nhãn hiển thị không được để trống`];
    } else if (f.label.trim().length > 120) {
      fieldErrors.requiredFields = [...(fieldErrors.requiredFields ?? []), `${prefix}: nhãn tối đa 120 ký tự`];
    }
    if (!REQUIRED_FIELD_TYPES.includes(f.type as (typeof REQUIRED_FIELD_TYPES)[number])) {
      fieldErrors.requiredFields = [...(fieldErrors.requiredFields ?? []), `${prefix}: kiểu dữ liệu không hợp lệ`];
    }
    if (f.type === 'SELECT') {
      const opts = (f.options ?? []).map((o) => o.trim()).filter(Boolean);
      if (opts.length === 0) {
        fieldErrors.requiredFields = [...(fieldErrors.requiredFields ?? []), `${prefix}: kiểu “Chọn một” cần ít nhất một lựa chọn`];
      }
    }
  });
  return fieldErrors;
}

export function validateWorkTypeCreate(values: WorkTypeFormValues): ValidationResult {
  const fieldErrors: Record<string, string[]> = {};

  const code = values.code.trim();
  if (!code) fieldErrors.code = ['Mã loại công việc không được để trống'];
  else if (code.length < 2 || code.length > 50) fieldErrors.code = ['Mã loại công việc phải từ 2 đến 50 ký tự'];
  else if (!CODE_RE.test(code)) fieldErrors.code = ['Mã loại công việc chỉ cho phép chữ, số, _ và -'];

  const name = values.name.trim();
  if (!name) fieldErrors.name = ['Tên loại công việc không được để trống'];
  else if (name.length > 150) fieldErrors.name = ['Tên loại công việc tối đa 150 ký tự'];

  if (values.description && values.description.trim().length > 500) {
    fieldErrors.description = ['Mô tả loại công việc tối đa 500 ký tự'];
  }
  if (values.group && values.group.trim().length > 100) {
    fieldErrors.group = ['Nhóm công việc tối đa 100 ký tự'];
  }

  const durationError = validateDurationMinutes(values.defaultDurationMinutes);
  if (durationError) fieldErrors.defaultDurationMinutes = [durationError];
  const priorityError = validatePriority(values.defaultPriority);
  if (priorityError) fieldErrors.defaultPriority = [priorityError];

  Object.assign(fieldErrors, validateRequiredFields(values.requiredFields));

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors };
}

export function validateWorkTypeUpdate(values: Partial<WorkTypeFormValues>): ValidationResult {
  const fieldErrors: Record<string, string[]> = {};

  if (values.code !== undefined) {
    const v = values.code.trim();
    if (!v) fieldErrors.code = ['Mã loại công việc không được để trống'];
    else if (v.length < 2 || v.length > 50) fieldErrors.code = ['Mã loại công việc phải từ 2 đến 50 ký tự'];
    else if (!CODE_RE.test(v)) fieldErrors.code = ['Mã loại công việc chỉ cho phép chữ, số, _ và -'];
  }
  if (values.name !== undefined) {
    const v = values.name.trim();
    if (!v) fieldErrors.name = ['Tên loại công việc không được để trống'];
    else if (v.length > 150) fieldErrors.name = ['Tên loại công việc tối đa 150 ký tự'];
  }
  if (values.description !== undefined && values.description && values.description.trim().length > 500) {
    fieldErrors.description = ['Mô tả loại công việc tối đa 500 ký tự'];
  }
  if (values.group !== undefined && values.group && values.group.trim().length > 100) {
    fieldErrors.group = ['Nhóm công việc tối đa 100 ký tự'];
  }
  if (values.defaultDurationMinutes !== undefined) {
    const durationError = validateDurationMinutes(values.defaultDurationMinutes);
    if (durationError) fieldErrors.defaultDurationMinutes = [durationError];
  }
  if (values.defaultPriority !== undefined) {
    const priorityError = validatePriority(values.defaultPriority);
    if (priorityError) fieldErrors.defaultPriority = [priorityError];
  }
  if (values.requiredFields !== undefined) {
    Object.assign(fieldErrors, validateRequiredFields(values.requiredFields));
  }

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors };
}
