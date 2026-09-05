/**
 * Audit log API client (IAM-SRS-008, GitHub issue #23).
 * Endpoint: GET /api/v1/audit-logs — JwtAuthGuard + ADMIN-only.
 * Trả về trang {data, total, limit, offset}; bộ lọc chỉ serialize khi có giá trị.
 * Lưu ý: beforeData/afterData có thể chứa secrets (mật khẩu/token) — client không render.
 */
export interface AuditLog {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  reason: string | null;
  result: 'SUCCESS' | 'FAILED' | string;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  createdAt: string;
}

export interface AuditLogFilters {
  action?: string;
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  result?: string;
  correlationId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogPage {
  data: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

export type AuditLogError = {
  status: number;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

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

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const body: unknown = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const msg = typeof b.message === 'string' ? b.message : typeof b.error === 'string' ? b.error : undefined;
    if (Array.isArray(b.message)) {
      const fieldErrors: Record<string, string[]> = {};
      for (const m of b.message as unknown[]) {
        if (typeof m !== 'string') continue;
        const lower = m.toLowerCase();
        // Thứ tự quan trọng: 'limit'/'offset' phải trước 'to' (nhiều message chứa " to "),
        // 'from' trước 'to' để không nuốt nhau.
        if (lower.includes('hành động') || lower.includes('action')) fieldErrors.action = [...(fieldErrors.action ?? []), m];
        else if (lower.includes('actor')) fieldErrors.actor = [...(fieldErrors.actor ?? []), m];
        else if (lower.includes('entity type') || lower.includes('entitytype')) fieldErrors.entityType = [...(fieldErrors.entityType ?? []), m];
        else if (lower.includes('entity id') || lower.includes('entityid')) fieldErrors.entityId = [...(fieldErrors.entityId ?? []), m];
        else if (lower.includes('correlation')) fieldErrors.correlationId = [...(fieldErrors.correlationId ?? []), m];
        else if (lower.includes('kết quả') || lower.includes('result')) fieldErrors.result = [...(fieldErrors.result ?? []), m];
        else if (lower.includes('limit')) fieldErrors.limit = [...(fieldErrors.limit ?? []), m];
        else if (lower.includes('offset')) fieldErrors.offset = [...(fieldErrors.offset ?? []), m];
        else if (lower.includes('từ ngày') || lower.includes('from')) fieldErrors.from = [...(fieldErrors.from ?? []), m];
        else if (lower.includes('đến ngày') || /\bto\b/.test(lower)) fieldErrors.to = [...(fieldErrors.to ?? []), m];
        else fieldErrors._global = [...(fieldErrors._global ?? []), m];
      }
      throw { status: res.status, message: msg ?? fallback, fieldErrors } satisfies AuditLogError;
    }
    if (msg) throw { status: res.status, message: msg } satisfies AuditLogError;
  }
  if (typeof body === 'string' && body.length > 0) {
    throw { status: res.status, message: body } satisfies AuditLogError;
  }
  throw { status: res.status, message: fallback } satisfies AuditLogError;
}

function toCount(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function listAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogPage> {
  const qs = new URLSearchParams();
  if (filters.action) qs.set('action', filters.action);
  if (filters.actorUserId) qs.set('actorUserId', filters.actorUserId);
  if (filters.entityType) qs.set('entityType', filters.entityType);
  if (filters.entityId) qs.set('entityId', filters.entityId);
  if (filters.result) qs.set('result', filters.result);
  if (filters.correlationId) qs.set('correlationId', filters.correlationId);
  // from/to date-only ('YYYY-MM-DD') gửi nguyên dạng — server tự normalize
  // (from → 00:00:00.000Z, to → 23:59:59.999Z), client không tự convert timestamp.
  if (filters.from) qs.set('from', filters.from);
  if (filters.to) qs.set('to', filters.to);
  if (filters.limit !== undefined) qs.set('limit', String(filters.limit));
  if (filters.offset !== undefined) qs.set('offset', String(filters.offset));
  const url = `${getApiBaseUrl()}/api/v1/audit-logs${qs.toString() ? `?${qs.toString()}` : ''}`;
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
  if (!res.ok) {
    await parseError(res, `Tải nhật ký thao tác thất bại (${res.status})`);
  }
  const body: unknown = await res.json().catch(() => null);
  const defaultLimit = filters.limit ?? 20;
  const defaultOffset = filters.offset ?? 0;
  if (Array.isArray(body)) {
    return { data: body as AuditLog[], total: body.length, limit: defaultLimit, offset: defaultOffset };
  }
  if (body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)) {
    const b = body as { data: AuditLog[]; total?: unknown; limit?: unknown; offset?: unknown };
    return {
      data: b.data,
      total: toCount(b.total, b.data.length),
      limit: toCount(b.limit, defaultLimit),
      offset: toCount(b.offset, defaultOffset),
    };
  }
  return { data: [], total: 0, limit: defaultLimit, offset: defaultOffset };
}
