import type { RequiredSkill, ChecklistSnapshotItem } from '@/lib/api/work-order-templates';

export interface WorkOrderTemplateFormValues {
  code: string;
  name: string;
  description: string;
  workTypeId: string;
  requiredTradeId: string;
  requiredSkills: RequiredSkill[];
  checklistSnapshot: ChecklistSnapshotItem[];
  /** Giá trị thô từ ô nhập (chuỗi); rỗng = không đặt. */
  defaultDurationMinutes?: string | number | null;
  defaultPriority?: string;
}

export interface ValidationResult {
  valid: boolean;
  fieldErrors: Record<string, string[]>;
}

const CODE_RE = /^[A-Za-z0-9_-]+$/;
const SKILL_CODE_RE = /^[A-Za-z0-9_-]+$/;

export const CHECKLIST_ANSWER_TYPES = ['YES_NO', 'TEXT', 'NUMBER', 'PASS_FAIL'] as const;

export const CHECKLIST_ANSWER_TYPE_LABELS: Record<string, string> = {
  YES_NO: 'Có/Không',
  TEXT: 'Văn bản',
  NUMBER: 'Số',
  PASS_FAIL: 'Đạt/Không đạt',
};

export const WORK_ORDER_TEMPLATE_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export type WorkOrderTemplatePriorityValue = (typeof WORK_ORDER_TEMPLATE_PRIORITIES)[number];

export const WORK_ORDER_TEMPLATE_PRIORITY_LABELS: Record<string, string> = {
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
  if (!(WORK_ORDER_TEMPLATE_PRIORITIES as readonly string[]).includes(text)) {
    return 'Ưu tiên mặc định không hợp lệ (LOW/NORMAL/HIGH/URGENT)';
  }
  return null;
}

export function validateRequiredSkills(skills: RequiredSkill[]): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  const seen = new Map<string, number>();
  skills.forEach((s, i) => {
    const prefix = `Dòng ${i + 1}`;
    if (!s.code.trim()) {
      fieldErrors.requiredSkills = [...(fieldErrors.requiredSkills ?? []), `${prefix}: code kỹ năng không được để trống`];
    } else if (s.code.trim().length > 50) {
      fieldErrors.requiredSkills = [...(fieldErrors.requiredSkills ?? []), `${prefix}: code kỹ năng tối đa 50 ký tự`];
    } else if (!SKILL_CODE_RE.test(s.code.trim())) {
      fieldErrors.requiredSkills = [...(fieldErrors.requiredSkills ?? []), `${prefix}: code kỹ năng chỉ cho phép chữ, số, _ và -`];
    } else {
      const lower = s.code.trim().toLowerCase();
      if (seen.has(lower)) {
        fieldErrors.requiredSkills = [
          ...(fieldErrors.requiredSkills ?? []),
          `${prefix}: code “${s.code.trim()}” bị trùng với dòng ${seen.get(lower)! + 1}`,
        ];
      } else {
        seen.set(lower, i);
      }
    }
    if (!s.label.trim()) {
      fieldErrors.requiredSkills = [...(fieldErrors.requiredSkills ?? []), `${prefix}: nhãn kỹ năng không được để trống`];
    } else if (s.label.trim().length > 120) {
      fieldErrors.requiredSkills = [...(fieldErrors.requiredSkills ?? []), `${prefix}: nhãn kỹ năng tối đa 120 ký tự`];
    }
  });
  return fieldErrors;
}

export function validateChecklistSnapshot(items: ChecklistSnapshotItem[]): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  items.forEach((c, i) => {
    const prefix = `Mục ${i + 1}`;
    if (!c.title.trim()) {
      fieldErrors.checklistSnapshot = [...(fieldErrors.checklistSnapshot ?? []), `${prefix}: tiêu đề không được để trống`];
    } else if (c.title.trim().length > 250) {
      fieldErrors.checklistSnapshot = [...(fieldErrors.checklistSnapshot ?? []), `${prefix}: tiêu đề tối đa 250 ký tự`];
    }
    if (!CHECKLIST_ANSWER_TYPES.includes(c.answerType as (typeof CHECKLIST_ANSWER_TYPES)[number])) {
      fieldErrors.checklistSnapshot = [...(fieldErrors.checklistSnapshot ?? []), `${prefix}: kiểu trả lời không hợp lệ`];
    }
  });
  return fieldErrors;
}

export function validateWorkOrderTemplateCreate(values: WorkOrderTemplateFormValues): ValidationResult {
  const fieldErrors: Record<string, string[]> = {};

  const code = values.code.trim();
  if (!code) fieldErrors.code = ['Mã mẫu công việc không được để trống'];
  else if (code.length < 2 || code.length > 50) fieldErrors.code = ['Mã mẫu công việc phải từ 2 đến 50 ký tự'];
  else if (!CODE_RE.test(code)) fieldErrors.code = ['Mã mẫu công việc chỉ cho phép chữ, số, _ và -'];

  const name = values.name.trim();
  if (!name) fieldErrors.name = ['Tên mẫu công việc không được để trống'];
  else if (name.length > 150) fieldErrors.name = ['Tên mẫu công việc tối đa 150 ký tự'];

  if (values.description && values.description.trim().length > 500) {
    fieldErrors.description = ['Mô tả mẫu công việc tối đa 500 ký tự'];
  }

  const durationError = validateDurationMinutes(values.defaultDurationMinutes);
  if (durationError) fieldErrors.defaultDurationMinutes = [durationError];
  const priorityError = validatePriority(values.defaultPriority);
  if (priorityError) fieldErrors.defaultPriority = [priorityError];

  Object.assign(fieldErrors, validateRequiredSkills(values.requiredSkills));
  Object.assign(fieldErrors, validateChecklistSnapshot(values.checklistSnapshot));

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors };
}

export function validateWorkOrderTemplateUpdate(values: Partial<WorkOrderTemplateFormValues>): ValidationResult {
  const fieldErrors: Record<string, string[]> = {};

  if (values.code !== undefined) {
    const v = values.code.trim();
    if (!v) fieldErrors.code = ['Mã mẫu công việc không được để trống'];
    else if (v.length < 2 || v.length > 50) fieldErrors.code = ['Mã mẫu công việc phải từ 2 đến 50 ký tự'];
    else if (!CODE_RE.test(v)) fieldErrors.code = ['Mã mẫu công việc chỉ cho phép chữ, số, _ và -'];
  }
  if (values.name !== undefined) {
    const v = values.name.trim();
    if (!v) fieldErrors.name = ['Tên mẫu công việc không được để trống'];
    else if (v.length > 150) fieldErrors.name = ['Tên mẫu công việc tối đa 150 ký tự'];
  }
  if (values.description !== undefined && values.description && values.description.trim().length > 500) {
    fieldErrors.description = ['Mô tả mẫu công việc tối đa 500 ký tự'];
  }
  if (values.defaultDurationMinutes !== undefined) {
    const durationError = validateDurationMinutes(values.defaultDurationMinutes);
    if (durationError) fieldErrors.defaultDurationMinutes = [durationError];
  }
  if (values.defaultPriority !== undefined) {
    const priorityError = validatePriority(values.defaultPriority);
    if (priorityError) fieldErrors.defaultPriority = [priorityError];
  }
  if (values.requiredSkills !== undefined) {
    Object.assign(fieldErrors, validateRequiredSkills(values.requiredSkills));
  }
  if (values.checklistSnapshot !== undefined) {
    Object.assign(fieldErrors, validateChecklistSnapshot(values.checklistSnapshot));
  }

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors };
}
