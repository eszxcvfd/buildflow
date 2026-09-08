/**
 * JOB-SRS-002 (issue #42) — publish-check API client (Web part).
 *
 * Contract: GET /api/v1/work-orders/:id/publish-check (ENDPOINTS §17, J6) —
 * advisory read-only, `Cache-Control: no-store`, scope y hệt `GET :id`
 * (ACTIVE member mọi role + ADMIN bypass; non-member 403 kể cả id không tồn
 * tại; ADMIN + id missing → 404; id sai → 400; anon → 401).
 * - GET không mang `X-Correlation-Id` (mirror `getWorkOrder` — server chỉ
 *   validate correlation cho write).
 * - Lỗi giữ nguyên shape `{ status, message, code?, fieldErrors?, traceId? }`
 *   (pattern work-orders.ts).
 */

export interface PublishCheckUnmet {
  code: string;
  field: string;
  message: string;
}

export interface PublishCheckResult {
  workOrderId: string;
  status: string;
  ready: boolean;
  unmet: PublishCheckUnmet[];
  checkedAt: string;
}

export interface ReadinessApiError {
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

function toFieldErrors(raw: unknown): Record<string, string[]> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      const msgs = v.filter((x): x is string => typeof x === 'string');
      if (msgs.length > 0) out[k] = msgs;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
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
    if (msg) {
      throw {
        status: res.status,
        message: msg,
        code,
        fieldErrors: toFieldErrors(b.fieldErrors),
        traceId,
      } satisfies ReadinessApiError;
    }
  }
  if (typeof body === 'string' && body.length > 0) {
    throw { status: res.status, message: body } satisfies ReadinessApiError;
  }
  throw { status: res.status, message: fallback } satisfies ReadinessApiError;
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * JOB-SRS-002 — kiểm tra điều kiện công bố Work Order (advisory, read-only).
 * Lỗi: 400 id sai, 401 hết phiên, 403 ngoài project (kể cả id không tồn tại),
 * 404 ADMIN + id missing.
 */
export async function getWorkOrderPublishCheck(id: string): Promise<PublishCheckResult> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/work-orders/${encodeURIComponent(id)}/publish-check`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    await parseError(res, `Kiểm tra điều kiện công bố thất bại (${res.status})`);
  }
  return (await res.json()) as PublishCheckResult;
}
