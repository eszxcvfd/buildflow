/**
 * PRJ-SRS-004 (issue #35) — work-types API client.
 *
 * Contract: WorkTypesController — read + write mở cho ADMIN + PROJECT_MANAGER.
 * GET list/detail/active dùng `cache: 'no-store'`; lỗi 400 shape mới
 * `{ message, fieldErrors }` được giữ nguyên fieldErrors (pattern crews/trades).
 */

export type RequiredFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT' | 'PHOTO';

export interface RequiredField {
  key: string;
  label: string;
  type: RequiredFieldType | string;
  required?: boolean;
  options?: string[];
}

export type WorkTypeStatus = 'ACTIVE' | 'INACTIVE';

export interface RequiredTradeRef {
  id: string;
  code: string;
  name: string;
}

export interface WorkType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  group: string | null;
  requiredTradeId: string | null;
  /** Enrich client-side từ trades map (API chỉ trả requiredTradeId). */
  requiredTrade?: RequiredTradeRef | null;
  requiredFields: RequiredField[];
  configVersion: number;
  defaultDurationMinutes: number | null;
  defaultPriority: string;
  status: WorkTypeStatus | string;
  isActive: boolean;
  usableForNewWorkOrder: boolean;
  usage?: { workOrders: number };
  warning?: string;
  alreadyInState?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListWorkTypesParams {
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  group?: string;
  tradeId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListWorkTypesResult {
  data: WorkType[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateWorkTypePayload {
  code: string;
  name: string;
  description?: string | null;
  group?: string | null;
  requiredTradeId?: string | null;
  requiredFields?: RequiredField[];
  defaultDurationMinutes?: number | null;
  defaultPriority?: string;
}

export interface UpdateWorkTypePayload {
  code?: string;
  name?: string;
  description?: string | null;
  group?: string | null;
  requiredTradeId?: string | null;
  requiredFields?: RequiredField[];
  defaultDurationMinutes?: number | null;
  defaultPriority?: string;
  expectedConfigVersion?: number;
  reason?: string | null;
}

export interface UpdateWorkTypeResult {
  workType: WorkType;
  versionChanged: boolean;
}

export interface ChangeWorkTypeStatusPayload {
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
  if (lower.includes('mã loại') || lower.includes('code')) return { field: 'code' };
  if (lower.includes('tên loại') || (lower.includes('name') && !lower.includes('filename'))) return { field: 'name' };
  if (lower.includes('mô tả') || lower.includes('description')) return { field: 'description' };
  if (lower.includes('nhóm') || lower.includes('group')) return { field: 'group' };
  if (lower.includes('ngành nghề') || lower.includes('requiredtrade') || lower.includes('tradeid')) {
    return { field: 'requiredTradeId' };
  }
  if (lower.includes('dữ liệu bắt buộc') || lower.includes('requiredfield') || lower.includes('key ') || lower.includes('label') || lower.includes('options')) {
    return { field: 'requiredFields' };
  }
  if (lower.includes('cấu hình') || lower.includes('configversion') || lower.includes('concurrent') || lower.includes('người khác cập nhật')) {
    return { field: 'expectedConfigVersion' };
  }
  if (lower.includes('lý do') || lower.includes('reason')) return { field: 'reason' };
  if (lower.includes('hành động') || lower.includes('action') || lower.includes('trạng thái') || lower.includes('status') || lower.includes('x-correlation')) {
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
        const fallbackField = /xung đột|người khác cập nhật|config/i.test(msg) ? 'expectedConfigVersion' : 'code';
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

/** Chuẩn hóa profile API → WorkType web (thêm isActive từ status). */
export function normalizeWorkType(raw: Record<string, unknown>): WorkType {
  const r = raw as unknown as WorkType;
  return { ...r, isActive: r.status === 'ACTIVE' };
}

export async function searchWorkTypes(params: ListWorkTypesParams = {}): Promise<ListWorkTypesResult> {
  const base = getApiBaseUrl();
  const qs = new URLSearchParams();
  if (params.status && params.status !== 'ALL') qs.set('status', params.status);
  if (params.group) qs.set('group', params.group);
  if (params.tradeId) qs.set('tradeId', params.tradeId);
  if (params.search) qs.set('search', params.search);
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  const url = `${base}/api/v1/work-types${qs.toString() ? `?${qs.toString()}` : ''}`;
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
  if (!res.ok) {
    await parseError(res, `Danh sách loại công việc thất bại (${res.status})`);
  }
  const data = (await res.json()) as { data: Record<string, unknown>[]; total: number; limit: number; offset: number };
  return { ...data, data: data.data.map(normalizeWorkType) };
}

export async function listActiveWorkTypes(): Promise<{ data: WorkType[]; total: number }> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/work-types/active`, { headers: authHeaders(), cache: 'no-store' });
  if (!res.ok) {
    await parseError(res, `Danh sách loại công việc đang hoạt động thất bại (${res.status})`);
  }
  const data = (await res.json()) as { data: Record<string, unknown>[]; total: number };
  return { ...data, data: data.data.map(normalizeWorkType) };
}

export async function getWorkType(id: string): Promise<WorkType> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/work-types/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    await parseError(res, `Lấy loại công việc thất bại (${res.status})`);
  }
  return normalizeWorkType((await res.json()) as Record<string, unknown>);
}

export async function createWorkType(payload: CreateWorkTypePayload): Promise<WorkType> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/v1/work-types`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Tạo loại công việc thất bại (${res.status})`);
  }
  return normalizeWorkType((await res.json()) as Record<string, unknown>);
}

export async function updateWorkType(id: string, payload: UpdateWorkTypePayload): Promise<UpdateWorkTypeResult> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/v1/work-types/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Cập nhật loại công việc thất bại (${res.status})`);
  }
  const data = (await res.json()) as Record<string, unknown> & { versionChanged?: boolean };
  return { workType: normalizeWorkType(data), versionChanged: data.versionChanged === true };
}

export async function changeWorkTypeStatus(id: string, payload: ChangeWorkTypeStatusPayload): Promise<WorkType> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/v1/work-types/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Chuyển trạng thái loại công việc thất bại (${res.status})`);
  }
  return normalizeWorkType((await res.json()) as Record<string, unknown>);
}
