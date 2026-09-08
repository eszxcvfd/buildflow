/**
 * PRJ-SRS-008 (issue #39) — work-order-templates API client.
 *
 * Contract: WorkOrderTemplatesController — read + write mở cho ADMIN + PROJECT_MANAGER.
 * GET list/detail/active dùng `cache: 'no-store'`; lỗi 400 shape mới
 * `{ message, fieldErrors }` được giữ nguyên fieldErrors (pattern crews/trades/work-types).
 * Strict X-Correlation-Id chỉ validate format khi gửi (mirror work-types — client
 * không tự sinh header, API 400 khi header sai UUID).
 */

export interface RequiredSkill {
  code: string;
  label: string;
}

export type ChecklistAnswerType = 'YES_NO' | 'TEXT' | 'NUMBER' | 'PASS_FAIL';

export interface ChecklistSnapshotItem {
  title: string;
  answerType: ChecklistAnswerType | string;
  isRequired: boolean;
  isBlocking: boolean;
  requiresPhoto?: boolean;
  sequenceNo: number;
}

export type WorkOrderTemplateStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

export interface WorkOrderTemplate {
  id: string;
  code: string;
  name: string;
  description: string | null;
  workTypeId: string | null;
  requiredTradeId: string | null;
  defaultDurationMinutes: number | null;
  defaultPriority: string;
  requiredSkills: RequiredSkill[];
  checklistSnapshot: ChecklistSnapshotItem[];
  sourceChecklistTemplateId: string | null;
  status: WorkOrderTemplateStatus | string;
  version: number;
  /** Suy từ status phía client (API cũng trả kèm để JOB prefill dùng). */
  isActive: boolean;
  usableForNewWorkOrder: boolean;
  alreadyInState?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const WORK_ORDER_TEMPLATE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Ngừng hoạt động',
};

export interface ListWorkOrderTemplatesParams {
  status?: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ALL';
  workTypeId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListWorkOrderTemplatesResult {
  data: WorkOrderTemplate[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateWorkOrderTemplatePayload {
  code: string;
  name: string;
  description?: string | null;
  workTypeId?: string | null;
  requiredTradeId?: string | null;
  requiredSkills?: RequiredSkill[];
  checklistSnapshot?: ChecklistSnapshotItem[];
  sourceChecklistTemplateId?: string | null;
  defaultDurationMinutes?: number | null;
  defaultPriority?: string;
}

export interface UpdateWorkOrderTemplatePayload {
  code?: string;
  name?: string;
  description?: string | null;
  workTypeId?: string | null;
  requiredTradeId?: string | null;
  requiredSkills?: RequiredSkill[];
  checklistSnapshot?: ChecklistSnapshotItem[];
  sourceChecklistTemplateId?: string | null;
  defaultDurationMinutes?: number | null;
  defaultPriority?: string;
  expectedVersion?: number;
  reason?: string | null;
}

export interface UpdateWorkOrderTemplateResult {
  workOrderTemplate: WorkOrderTemplate;
  versionChanged: boolean;
}

export interface ChangeWorkOrderTemplateStatusPayload {
  action: 'ACTIVATE' | 'DEACTIVATE';
  reason?: string | null;
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
  fieldErrors?: Record<string, string[]>;
  traceId?: string;
}

function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('buildflow.auth.v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { accessToken?: string };
    return parsed?.accessToken ?? null;
  } catch {
    return null;
  }
}

function classifyMessage(m: string): { field: string } | null {
  const lower = m.toLowerCase();
  if (lower.includes('mã mẫu') || (lower.includes('code') && !lower.includes('skill'))) return { field: 'code' };
  if (lower.includes('tên mẫu') || (lower.includes('name') && !lower.includes('filename'))) return { field: 'name' };
  if (lower.includes('mô tả') || lower.includes('description')) return { field: 'description' };
  if (lower.includes('loại công việc') || lower.includes('worktype')) return { field: 'workTypeId' };
  if (lower.includes('ngành nghề') || lower.includes('requiredtrade') || lower.includes('tradeid')) {
    return { field: 'requiredTradeId' };
  }
  if (lower.includes('kỹ năng') || lower.includes('skill')) return { field: 'requiredSkills' };
  if (lower.includes('checklist') || lower.includes('answer') || lower.includes('title')) {
    return { field: 'checklistSnapshot' };
  }
  if (lower.includes('phiên bản') || lower.includes('version') || lower.includes('concurrent') || lower.includes('người khác cập nhật')) {
    return { field: 'expectedVersion' };
  }
  if (lower.includes('lý do') || lower.includes('reason')) return { field: 'reason' };
  if (lower.includes('hành động') || lower.includes('action') || lower.includes('trạng thái') || lower.includes('status') || lower.includes('x-correlation') || lower.includes('publish') || lower.includes('rỗng')) {
    return { field: 'status' };
  }
  if (lower.includes('thời lượng') || lower.includes('duration')) return { field: 'defaultDurationMinutes' };
  if (lower.includes('ưu tiên') || lower.includes('priority')) return { field: 'defaultPriority' };
  return null;
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const body: unknown = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (b.fieldErrors && typeof b.fieldErrors === 'object') {
      const raw = b.fieldErrors as Record<string, unknown>;
      const fieldErrors: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (Array.isArray(v)) fieldErrors[k] = v.filter((x): x is string => typeof x === 'string');
      }
      const msg = typeof b.message === 'string' ? b.message : fallback;
      const code = typeof b.code === 'string' ? b.code : undefined;
      const traceId = typeof b.traceId === 'string' ? b.traceId : undefined;
      throw { status: res.status, message: msg, code, fieldErrors, traceId } satisfies ApiError;
    }
    const msg = typeof b.message === 'string' ? b.message : typeof b.error === 'string' ? b.error : undefined;
    const code = typeof b.code === 'string' ? b.code : undefined;
    const traceId = typeof b.traceId === 'string' ? b.traceId : undefined;
    // Validation shape: { message: string[], statusCode: 400 }
    if (Array.isArray(b.message)) {
      const fieldErrors: Record<string, string[]> = {};
      for (const m of b.message as unknown[]) {
        if (typeof m !== 'string') continue;
        const hit = classifyMessage(m);
        const key = hit?.field ?? '_global';
        fieldErrors[key] = [...(fieldErrors[key] ?? []), m];
      }
      throw { status: res.status, message: msg ?? fallback, code, fieldErrors, traceId } satisfies ApiError;
    }
    // Single-string errors từ use case (400 domain rule, 409 trùng code /
    // xung đột version) — map về field để UI hiển thị đúng input.
    if (msg) {
      if (res.status === 409 && /(đã tồn tại|duplicate|unique|xung đột|người khác cập nhật)/i.test(msg)) {
        const hit = classifyMessage(msg);
        const fallbackField = /xung đột|người khác cập nhật|version/i.test(msg) ? 'expectedVersion' : 'code';
        throw { status: res.status, message: msg, code, fieldErrors: { [(hit?.field ?? fallbackField)]: [msg] }, traceId } satisfies ApiError;
      }
      const hit = classifyMessage(msg);
      if (res.status === 400 && hit) {
        throw { status: res.status, message: msg, code, fieldErrors: { [hit.field]: [msg] }, traceId } satisfies ApiError;
      }
      throw { status: res.status, message: msg, code, traceId } satisfies ApiError;
    }
  }
  if (typeof body === 'string' && body.length > 0) {
    throw { status: res.status, message: body } satisfies ApiError;
  }
  throw { status: res.status, message: fallback } satisfies ApiError;
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Chuẩn hóa profile API → WorkOrderTemplate web (thêm isActive từ status). */
export function normalizeWorkOrderTemplate(raw: Record<string, unknown>): WorkOrderTemplate {
  const r = raw as unknown as WorkOrderTemplate;
  return { ...r, isActive: r.status === 'ACTIVE' };
}

export async function searchWorkOrderTemplates(
  params: ListWorkOrderTemplatesParams = {},
): Promise<ListWorkOrderTemplatesResult> {
  const base = getApiBaseUrl();
  const qs = new URLSearchParams();
  if (params.status && params.status !== 'ALL') qs.set('status', params.status);
  if (params.workTypeId) qs.set('workTypeId', params.workTypeId);
  if (params.search) qs.set('search', params.search);
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  const url = `${base}/api/v1/work-order-templates${qs.toString() ? `?${qs.toString()}` : ''}`;
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
  if (!res.ok) {
    await parseError(res, `Danh sách mẫu công việc thất bại (${res.status})`);
  }
  const data = (await res.json()) as { data: Record<string, unknown>[]; total: number; limit: number; offset: number };
  return { ...data, data: data.data.map(normalizeWorkOrderTemplate) };
}

export async function listActiveWorkOrderTemplates(): Promise<{ data: WorkOrderTemplate[]; total: number }> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/work-order-templates/active`, { headers: authHeaders(), cache: 'no-store' });
  if (!res.ok) {
    await parseError(res, `Danh sách mẫu công việc đang hoạt động thất bại (${res.status})`);
  }
  const data = (await res.json()) as { data: Record<string, unknown>[]; total: number };
  return { ...data, data: data.data.map(normalizeWorkOrderTemplate) };
}

export async function getWorkOrderTemplate(id: string): Promise<WorkOrderTemplate> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/work-order-templates/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    await parseError(res, `Lấy mẫu công việc thất bại (${res.status})`);
  }
  return normalizeWorkOrderTemplate((await res.json()) as Record<string, unknown>);
}

export async function createWorkOrderTemplate(payload: CreateWorkOrderTemplatePayload): Promise<WorkOrderTemplate> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/v1/work-order-templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Tạo mẫu công việc thất bại (${res.status})`);
  }
  return normalizeWorkOrderTemplate((await res.json()) as Record<string, unknown>);
}

export async function updateWorkOrderTemplate(
  id: string,
  payload: UpdateWorkOrderTemplatePayload,
): Promise<UpdateWorkOrderTemplateResult> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/v1/work-order-templates/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Cập nhật mẫu công việc thất bại (${res.status})`);
  }
  const data = (await res.json()) as Record<string, unknown> & { versionChanged?: boolean };
  return { workOrderTemplate: normalizeWorkOrderTemplate(data), versionChanged: data.versionChanged === true };
}

export async function changeWorkOrderTemplateStatus(
  id: string,
  payload: ChangeWorkOrderTemplateStatusPayload,
): Promise<WorkOrderTemplate> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/v1/work-order-templates/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Chuyển trạng thái mẫu công việc thất bại (${res.status})`);
  }
  return normalizeWorkOrderTemplate((await res.json()) as Record<string, unknown>);
}
