export interface Contractor {
  id: string;
  code: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  status: 'ACTIVE' | 'INACTIVE' | string;
  scope: string | null;
  eligible: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListContractorsParams {
  status?: string;
  search?: string;
  scope?: string;
  eligibleOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListContractorsResult {
  data: Contractor[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateContractorPayload {
  code: string;
  name: string;
  contactName: string;
  phone?: string | null;
  email?: string | null;
  scope: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface UpdateContractorPayload {
  code?: string;
  name?: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  scope?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
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
    if (Array.isArray(b.message)) {
      const fieldErrors: Record<string, string[]> = {};
      for (const m of b.message as unknown[]) {
        if (typeof m !== 'string') continue;
        const lower = m.toLowerCase();
        if (lower.includes('mã nhà thầu') || lower.includes('code')) fieldErrors.code = [...(fieldErrors.code ?? []), m];
        else if (lower.includes('tên nhà thầu') || (lower.includes('tên') && !lower.includes('liên hệ'))) fieldErrors.name = [...(fieldErrors.name ?? []), m];
        else if (lower.includes('liên hệ') || lower.includes('contact')) fieldErrors.contactName = [...(fieldErrors.contactName ?? []), m];
        else if (lower.includes('phạm vi') || lower.includes('scope')) fieldErrors.scope = [...(fieldErrors.scope ?? []), m];
        else if (lower.includes('phone') || lower.includes('điện thoại')) fieldErrors.phone = [...(fieldErrors.phone ?? []), m];
        else if (lower.includes('email')) fieldErrors.email = [...(fieldErrors.email ?? []), m];
        else if (lower.includes('trạng thái') || lower.includes('status')) fieldErrors.status = [...(fieldErrors.status ?? []), m];
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

export async function listContractors(params: ListContractorsParams = {}): Promise<ListContractorsResult> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  if (params.scope) qs.set('scope', params.scope);
  if (params.eligibleOnly) qs.set('eligibleOnly', 'true');
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  const url = `${base}/api/v1/contractors${qs.toString() ? `?${qs.toString()}` : ''}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    await parseError(res, `Danh sách contractor thất bại (${res.status})`);
  }
  const data = (await res.json()) as ListContractorsResult;
  return data;
}

export async function getContractor(id: string): Promise<Contractor> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/v1/contractors/${encodeURIComponent(id)}`, {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    await parseError(res, `Lấy contractor thất bại (${res.status})`);
  }
  return (await res.json()) as Contractor;
}

export async function createContractor(payload: CreateContractorPayload): Promise<Contractor> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/v1/contractors`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Tạo contractor thất bại (${res.status})`);
  }
  return (await res.json()) as Contractor;
}

export async function updateContractor(id: string, payload: UpdateContractorPayload): Promise<Contractor> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/v1/contractors/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Cập nhật contractor thất bại (${res.status})`);
  }
  return (await res.json()) as Contractor;
}
