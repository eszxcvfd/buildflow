import type { CreateWorkOrderPayload } from '@/lib/api/work-orders';

export interface WorkOrderFormValues {
  title: string;
  /** Mã client tự đặt — rỗng = để hệ thống tự sinh. */
  code: string;
  workTypeId: string;
  areaId: string;
  requiredTradeId: string;
  priority: WorkOrderPriorityValue;
  /** Giá trị thô từ input datetime-local; rỗng = không đặt. */
  plannedStartAt: string;
  plannedEndAt: string;
  /** Giá trị thô từ ô nhập (chuỗi); rỗng = không đặt. */
  plannedHeadcount: string;
  description: string;
  instructions: string;
  /**
   * Giá trị thô phần Dữ liệu bổ sung (J8) — key → chuỗi nhập từ ô theo loại
   * `required_fields` của work-type; rỗng = không nhập (không gửi key đó).
   */
  customFieldValues: Record<string, string>;
}

export interface ValidationResult {
  valid: boolean;
  fieldErrors: Record<string, string[]>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const WORK_ORDER_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export type WorkOrderPriorityValue = (typeof WORK_ORDER_PRIORITIES)[number];

export function defaultWorkOrderFormValues(): WorkOrderFormValues {
  return {
    title: '',
    code: '',
    workTypeId: '',
    areaId: '',
    requiredTradeId: '',
    priority: 'NORMAL',
    plannedStartAt: '',
    plannedEndAt: '',
    plannedHeadcount: '',
    description: '',
    instructions: '',
    customFieldValues: {},
  };
}

function validateHeadcount(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  if (!/^\d+$/.test(text)) return 'Số người dự kiến phải là số nguyên từ 1 đến 99';
  const n = Number(text);
  if (n < 1 || n > 99) return 'Số người dự kiến phải là số nguyên từ 1 đến 99';
  return null;
}

function validatePlannedRange(startRaw: string, endRaw: string): { field: 'plannedStartAt' | 'plannedEndAt'; message: string } | null {
  const startText = startRaw.trim();
  const endText = endRaw.trim();
  if (!startText || !endText) return null;
  const start = new Date(startText);
  const end = new Date(endText);
  if (Number.isNaN(start.getTime())) {
    return { field: 'plannedStartAt', message: 'Thời điểm bắt đầu kế hoạch không hợp lệ' };
  }
  if (Number.isNaN(end.getTime())) {
    return { field: 'plannedEndAt', message: 'Thời điểm kết thúc kế hoạch không hợp lệ' };
  }
  if (!(start < end)) {
    return { field: 'plannedEndAt', message: 'Thời điểm kết thúc kế hoạch phải sau thời điểm bắt đầu' };
  }
  return null;
}

/**
 * JOB-SRS-001 (issue #41) — validate form tạo Work Order nháp phía client
 * (server là authoritative; mirror validateWorkTypeCreate).
 */
export function validateWorkOrderCreate(values: WorkOrderFormValues): ValidationResult {
  const fieldErrors: Record<string, string[]> = {};

  const title = values.title.trim();
  if (!title) fieldErrors.title = ['Tiêu đề công việc không được để trống'];
  else if (title.length > 200) fieldErrors.title = ['Tiêu đề công việc tối đa 200 ký tự'];

  if (!values.workTypeId.trim()) {
    fieldErrors.workTypeId = ['Loại công việc không được để trống'];
  }

  if (values.areaId.trim() && !UUID_RE.test(values.areaId.trim())) {
    fieldErrors.areaId = ['Khu vực không hợp lệ'];
  }
  if (values.requiredTradeId.trim() && !UUID_RE.test(values.requiredTradeId.trim())) {
    fieldErrors.requiredTradeId = ['Ngành nghề yêu cầu không hợp lệ'];
  }

  if (!(WORK_ORDER_PRIORITIES as readonly string[]).includes(values.priority)) {
    fieldErrors.priority = ['Ưu tiên công việc không hợp lệ (LOW/NORMAL/HIGH/URGENT)'];
  }

  const rangeError = validatePlannedRange(values.plannedStartAt, values.plannedEndAt);
  if (rangeError) {
    fieldErrors[rangeError.field] = [rangeError.message];
  }

  const headcountError = validateHeadcount(values.plannedHeadcount);
  if (headcountError) fieldErrors.plannedHeadcount = [headcountError];

  if (values.description.trim().length > 5000) {
    fieldErrors.description = ['Mô tả công việc tối đa 5000 ký tự'];
  }
  if (values.instructions.trim().length > 5000) {
    fieldErrors.instructions = ['Hướng dẫn công việc tối đa 5000 ký tự'];
  }

  return { valid: Object.keys(fieldErrors).length === 0, fieldErrors };
}

function toIsoOrNull(datetimeLocal: string): string | null {
  const text = datetimeLocal.trim();
  if (!text) return null;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Map giá trị thô Dữ liệu bổ sung → payload `customFields` (J8): ô trống bị
 * bỏ qua (PATCH partial: absent = giữ nguyên); NUMBER parse số khi được
 * (không parse được → giữ chuỗi, server publish-check fail với message rõ);
 * BOOLEAN `true`/`false`/`1`/`0` → boolean; còn lại giữ chuỗi đã trim.
 */
export function toCustomFieldsPayload(
  raw: Record<string, string>,
  typesByKey?: Record<string, string>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(raw)) {
    const text = (value ?? '').trim();
    if (!text) continue;
    const type = (typesByKey?.[key] ?? '').toUpperCase();
    if (type === 'NUMBER') {
      const n = Number(text);
      out[key] = text !== '' && !Number.isNaN(n) ? n : text;
      continue;
    }
    if (type === 'BOOLEAN') {
      const lowered = text.toLowerCase();
      if (lowered === 'true' || lowered === '1') {
        out[key] = true;
        continue;
      }
      if (lowered === 'false' || lowered === '0') {
        out[key] = false;
        continue;
      }
    }
    out[key] = text;
  }
  return out;
}

/**
 * Map form values → payload POST /api/v1/work-orders. Các field optional rỗng
 * được gửi null (server whitelist + DTO chấp nhận null); `requestKey` do
 * dialog sinh một lần mỗi phiên mở và truyền vào.
 */
export function toCreateWorkOrderPayload(
  projectId: string,
  values: WorkOrderFormValues,
  requestKey: string,
  requiredFieldTypes?: Record<string, string>,
): CreateWorkOrderPayload {
  const headcountText = values.plannedHeadcount.trim();
  const customFields = toCustomFieldsPayload(values.customFieldValues ?? {}, requiredFieldTypes);
  return {
    projectId,
    title: values.title.trim(),
    workTypeId: values.workTypeId.trim(),
    areaId: values.areaId.trim() || null,
    requiredTradeId: values.requiredTradeId.trim() || null,
    code: values.code.trim() || null,
    description: values.description.trim() || null,
    instructions: values.instructions.trim() || null,
    priority: (values.priority || 'NORMAL') as WorkOrderPriorityValue,
    plannedStartAt: toIsoOrNull(values.plannedStartAt),
    plannedEndAt: toIsoOrNull(values.plannedEndAt),
    plannedHeadcount: headcountText === '' ? null : Number(headcountText),
    customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
    requestKey,
  };
}
