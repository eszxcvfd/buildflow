export interface WorkerTrade {
  tradeId: string;
  skillLevel: number;
  effectiveFrom?: string;
  isActive?: boolean;
}

export interface Worker {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  employeeCode: string | null;
  userType: string;
  contractorId: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED' | string;
  trades: WorkerTrade[];
  eligible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListWorkersParams {
  status?: string;
  search?: string;
  tradeId?: string;
  skillLevel?: number;
  limit?: number;
  offset?: number;
}

export interface ListWorkersResult {
  data: Worker[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateWorkerPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string | null;
  employeeCode?: string | null;
  contractorId?: string | null;
  trades?: Array<{ tradeId: string; skillLevel: number }>;
}

export interface UpdateWorkerPayload {
  fullName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  employeeCode?: string | null;
  contractorId?: string | null;
  trades?: Array<{ tradeId: string; skillLevel: number }>;
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

async function parseError(res: Response, fallback: string): Promise<never> {
  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const body: unknown = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const msg = typeof b.message === 'string' ? b.message : typeof b.error === 'string' ? b.error : undefined;
    const code = typeof b.code === 'string' ? b.code : undefined;
    const traceId = typeof b.traceId === 'string' ? b.traceId : undefined;
    // Validation shape: { message: string[], statusCode: 400 }
    if (Array.isArray(b.message)) {
      const fieldErrors: Record<string, string[]> = {};
      for (const m of b.message as unknown[]) {
        if (typeof m !== 'string') continue;
        const lower = m.toLowerCase();
        if (lower.includes('email')) fieldErrors.email = [...(fieldErrors.email ?? []), m];
        else if (lower.includes('employee') || lower.includes('mã nhân viên')) fieldErrors.employeeCode = [...(fieldErrors.employeeCode ?? []), m];
        else if (lower.includes('full') || lower.includes('tên')) fieldErrors.fullName = [...(fieldErrors.fullName ?? []), m];
        else if (lower.includes('phone')) fieldErrors.phone = [...(fieldErrors.phone ?? []), m];
        else if (lower.includes('trade')) fieldErrors.trades = [...(fieldErrors.trades ?? []), m];
        else if (lower.includes('skill')) fieldErrors.trades = [...(fieldErrors.trades ?? []), m];
        else if (lower.includes('password') || lower.includes('mật khẩu')) fieldErrors.password = [...(fieldErrors.password ?? []), m];
        else fieldErrors._global = [...(fieldErrors._global ?? []), m];
      }
      throw { status: res.status, message: msg ?? fallback, code, fieldErrors, traceId } satisfies ApiError;
    }
    if (msg) throw { status: res.status, message: msg, code, traceId } satisfies ApiError;
  }
  if (typeof body === 'string' && body.length > 0) {
    throw { status: res.status, message: body } satisfies ApiError;
  }
  throw { status: res.status, message: fallback } satisfies ApiError;
}

export async function listWorkers(params: ListWorkersParams = {}): Promise<ListWorkersResult> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  if (params.tradeId) qs.set('tradeId', params.tradeId);
  if (params.skillLevel !== undefined) qs.set('skillLevel', String(params.skillLevel));
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  const url = `${base}/api/v1/workers${qs.toString() ? `?${qs.toString()}` : ''}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    await parseError(res, `Danh sách worker thất bại (${res.status})`);
  }
  const data = (await res.json()) as ListWorkersResult;
  return data;
}

export async function getWorker(id: string): Promise<Worker> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/v1/workers/${encodeURIComponent(id)}`, {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    await parseError(res, `Lấy worker thất bại (${res.status})`);
  }
  return (await res.json()) as Worker;
}

export async function createWorker(payload: CreateWorkerPayload): Promise<Worker> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/v1/workers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Tạo worker thất bại (${res.status})`);
  }
  return (await res.json()) as Worker;
}

export async function updateWorker(id: string, payload: UpdateWorkerPayload): Promise<Worker> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/v1/workers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Cập nhật worker thất bại (${res.status})`);
  }
  return (await res.json()) as Worker;
}
