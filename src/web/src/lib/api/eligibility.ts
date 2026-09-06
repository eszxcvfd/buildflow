/**
 * ORG-SRS-008 (issue #31) — eligibility API client (pre-check điều kiện nhận việc).
 *
 * Contract: GET /api/v1/eligibility/workers/:workerId?tradeId=&skillLevel=&at=
 * (ADMIN + PROJECT_MANAGER), GET /api/v1/eligibility/crews/:crewId
 * (ADMIN + PROJECT_MANAGER), GET /api/v1/eligibility/me (mọi user đã đăng nhập,
 * server tự resolve worker theo JWT sub). Mọi GET dùng `cache: 'no-store'`;
 * lỗi theo parseError conventions (ApiError { status, message, code?,
 * fieldErrors?, traceId? }).
 *
 * Ngữ nghĩa pass (server): `passed: true` đạt, `passed: false` không đạt
 * (kéo `eligible` về false), `passed: null` không áp dụng/không đánh giá được
 * (NOT_REQUESTED, NOT_EVALUABLE — không ảnh hưởng `eligible`).
 */

export interface EligibilityCondition {
  code: string;
  passed: boolean | null;
  reasonCode: string;
  detail: string;
}

export interface WorkerEligibilityCrewInfo {
  crewId: string;
  crewCode: string;
  crewName: string;
  memberRole: 'LEAD' | 'MEMBER';
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface CrewEligibilityMemberInfo {
  memberId: string;
  userId: string;
  memberRole: 'LEAD' | 'MEMBER';
  effectiveFrom: string;
  effectiveTo: string | null;
}

interface EligibilityResultBase {
  resourceId: string;
  eligible: boolean;
  checkedAt: string;
  correlationId: string;
  conditions: EligibilityCondition[];
}

export interface WorkerEligibilityResult extends EligibilityResultBase {
  resourceType: 'WORKER';
  crews: WorkerEligibilityCrewInfo[];
}

export interface CrewEligibilityResult extends EligibilityResultBase {
  resourceType: 'CREW';
  members: CrewEligibilityMemberInfo[];
}

export type EligibilityResult = WorkerEligibilityResult | CrewEligibilityResult;

export interface EligibilityQuery {
  tradeId?: string;
  skillLevel?: number;
  /** Ngày tham chiếu YYYY-MM-DD (API default today). */
  at?: string;
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

function toFieldErrors(raw: unknown): Record<string, string[]> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      const msgs = value.filter((m): m is string => typeof m === 'string');
      if (msgs.length) out[key] = msgs;
    } else if (typeof value === 'string') {
      out[key] = [value];
    }
  }
  return Object.keys(out).length ? out : undefined;
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
      throw { status: res.status, message: msg, code, fieldErrors: toFieldErrors(b.fieldErrors), traceId } satisfies ApiError;
    }
  }
  if (typeof body === 'string' && body.length > 0) {
    throw { status: res.status, message: body } satisfies ApiError;
  }
  throw { status: res.status, message: fallback } satisfies ApiError;
}

function buildWorkerQuery(params: EligibilityQuery = {}): string {
  const qs = new URLSearchParams();
  if (params.tradeId) qs.set('tradeId', params.tradeId);
  if (params.skillLevel !== undefined) qs.set('skillLevel', String(params.skillLevel));
  if (params.at) qs.set('at', params.at);
  return qs.toString() ? `?${qs.toString()}` : '';
}

async function getJson<T>(url: string, fallback: string): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    await parseError(res, `${fallback} (${res.status})`);
  }
  return (await res.json()) as T;
}

/** Pre-check worker (ADMIN + PROJECT_MANAGER). Dữ liệu stale → caller buộc refresh. */
export async function checkWorkerEligibility(
  workerId: string,
  params: EligibilityQuery = {},
): Promise<WorkerEligibilityResult> {
  const base = getApiBaseUrl();
  return getJson<WorkerEligibilityResult>(
    `${base}/api/v1/eligibility/workers/${encodeURIComponent(workerId)}${buildWorkerQuery(params)}`,
    'Kiểm tra điều kiện nhận việc thất bại',
  );
}

/** Pre-check crew (ADMIN + PROJECT_MANAGER). */
export async function checkCrewEligibility(crewId: string): Promise<CrewEligibilityResult> {
  const base = getApiBaseUrl();
  return getJson<CrewEligibilityResult>(
    `${base}/api/v1/eligibility/crews/${encodeURIComponent(crewId)}`,
    'Kiểm tra điều kiện nhận việc của đội thất bại',
  );
}

/**
 * Tự kiểm tra của worker đang đăng nhập (mọi role). 404
 * (code RESOURCE_NOT_FOUND, 'user không có hồ sơ worker') nghĩa là tài khoản
 * chưa có hồ sơ worker — caller hiển thị empty state, không báo lỗi.
 */
export async function checkMyEligibility(params: EligibilityQuery = {}): Promise<WorkerEligibilityResult> {
  const base = getApiBaseUrl();
  return getJson<WorkerEligibilityResult>(
    `${base}/api/v1/eligibility/me${buildWorkerQuery(params)}`,
    'Tự kiểm tra điều kiện nhận việc thất bại',
  );
}
