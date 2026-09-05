export interface Trade {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE' | string;
  assignable: boolean;
  createdAt: string;
  updatedAt: string;
  warning?: string;
}

export type TradeStatus = 'ACTIVE' | 'INACTIVE';

export interface ListTradesParams {
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListTradesResult {
  data: Trade[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateTradePayload {
  code: string;
  name: string;
  description?: string | null;
  status?: TradeStatus;
}

export interface UpdateTradePayload {
  code?: string;
  name?: string;
  description?: string | null;
}

export interface ChangeTradeStatusPayload {
  status: TradeStatus;
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
  if (lower.includes('mã ngành nghề') || lower.includes('code')) return { field: 'code' };
  if (lower.includes('tên ngành nghề') || lower.includes('name')) return { field: 'name' };
  if (lower.includes('mô tả') || lower.includes('description')) return { field: 'description' };
  if (lower.includes('trạng thái') || lower.includes('status') || lower.includes('x-correlation')) return { field: 'status' };
  return null;
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
        const hit = classifyMessage(m);
        const key = hit?.field ?? '_global';
        fieldErrors[key] = [...(fieldErrors[key] ?? []), m];
      }
      throw { status: res.status, message: msg ?? fallback, code, fieldErrors, traceId } satisfies ApiError;
    }
    // Single-string errors from use cases (400 domain rule or 409 dup code) —
    // map onto the field when the message names it, so the UI shows the error on
    // the right input instead of a generic banner.
    if (msg) {
      if (res.status === 409 && /(đã tồn tại|duplicate|unique)/i.test(msg)) {
        const hit = classifyMessage(msg);
        throw { status: res.status, message: msg, code, fieldErrors: { [(hit?.field ?? 'code')]: [msg] }, traceId } satisfies ApiError;
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

export async function listTrades(params: ListTradesParams = {}): Promise<ListTradesResult> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const qs = new URLSearchParams();
  if (params.status && params.status !== 'ALL') qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  const url = `${base}/api/v1/trades${qs.toString() ? `?${qs.toString()}` : ''}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    await parseError(res, `Danh sách ngành nghề thất bại (${res.status})`);
  }
  const data = (await res.json()) as ListTradesResult;
  return data;
}

export async function getTrade(id: string): Promise<Trade> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/v1/trades/${encodeURIComponent(id)}`, {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    await parseError(res, `Lấy ngành nghề thất bại (${res.status})`);
  }
  return (await res.json()) as Trade;
}

export async function createTrade(payload: CreateTradePayload): Promise<Trade> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/v1/trades`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Tạo ngành nghề thất bại (${res.status})`);
  }
  return (await res.json()) as Trade;
}

export async function updateTrade(id: string, payload: UpdateTradePayload): Promise<Trade> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/v1/trades/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Cập nhật ngành nghề thất bại (${res.status})`);
  }
  return (await res.json()) as Trade;
}

export async function changeTradeStatus(id: string, payload: ChangeTradeStatusPayload): Promise<Trade> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/v1/trades/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Chuyển trạng thái ngành nghề thất bại (${res.status})`);
  }
  return (await res.json()) as Trade;
}
