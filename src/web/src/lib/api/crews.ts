/**
 * ORG-SRS-006 (issue #29) — crews API client.
 *
 * Contract: docs/architecture/ENDPOINTS.md §8. Read + write mở cho
 * ADMIN + PROJECT_MANAGER (khác write admin-only của workers/contractors/trades).
 * GET list/detail dùng `cache: 'no-store'`; lỗi 400 shape mới
 * `{ message, fieldErrors }` được giữ nguyên fieldErrors (pattern contractors.ts).
 */

export interface Crew {
  id: string;
  code: string;
  name: string;
  description: string | null;
  contractorId: string | null;
  status: 'ACTIVE' | 'INACTIVE' | string;
  eligible: boolean;
  leaderUserId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListCrewsParams {
  status?: string;
  search?: string;
  eligibleOnly?: boolean;
  /** ORG-SRS-006 — sort whitelist: name|createdAt */
  sort?: string;
  /** ORG-SRS-006 — order whitelist: asc|desc */
  order?: string;
  limit?: number;
  offset?: number;
}

export interface ListCrewsResult {
  data: Crew[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateCrewPayload {
  code: string;
  name: string;
  leaderUserId: string;
  contractorId?: string | null;
  description?: string | null;
}

export interface UpdateCrewPayload {
  name?: string;
  description?: string | null;
  leaderUserId?: string;
  contractorId?: string | null;
}

/**
 * ORG-SRS-006 — lifecycle status (reuse resource-status.policy:
 * ACTIVATE→ACTIVE, SUSPEND/TERMINATE→INACTIVE).
 */
export type CrewLifecycleAction = 'ACTIVATE' | 'SUSPEND' | 'TERMINATE';

export interface ChangeCrewLifecycleStatusPayload {
  action: CrewLifecycleAction;
  reason?: string | null;
}

export interface OpenWorkResult {
  openAssignments: number;
}

/**
 * ORG-SRS-007 (issue #30) — thành viên đội (MEMBER qua slice này, LEAD qua
 * PATCH /crews/:id leaderUserId swap). Response DTO: id/userId/memberRole/
 * effectiveFrom (date-only YYYY-MM-DD)/effectiveTo/isActive/addedBy/createdAt
 * + userName/userCode join từ users (nullable).
 */
export interface CrewMember {
  id: string;
  userId: string;
  memberRole: 'LEAD' | 'MEMBER' | string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  addedBy: string;
  createdAt: string;
  userName: string | null;
  userCode: string | null;
}

export interface ListCrewMembersParams {
  /** Point-in-time roster: members có [effectiveFrom, effectiveTo] INCLUSIVE hai đầu bao phủ date (effectiveTo null = open-ended). */
  at?: string;
  /** true → toàn bộ lịch sử (past members kèm effectiveTo), false/default → chỉ active. */
  includeInactive?: boolean;
}

export interface ListCrewMembersResult {
  data: CrewMember[];
  total: number;
}

export interface AddCrewMemberPayload {
  userId: string;
  /** ISO date YYYY-MM-DD, optional — API default today. */
  effectiveFrom?: string | null;
}

export interface OtherCrewRef {
  crewId: string;
  crewCode: string;
  crewName: string;
}

/** POST /crews/:id/members → 201 member + warning? MEMBER_IN_OTHER_CREW (vẫn thêm thành công). */
export type AddCrewMemberResult = CrewMember & {
  warning?: { code: 'MEMBER_IN_OTHER_CREW'; otherCrews: OtherCrewRef[] } | null;
};

export interface RemoveCrewMemberPayload {
  /** ISO date YYYY-MM-DD, optional — API default today, phải >= effectiveFrom. */
  effectiveTo?: string | null;
  /** Lý do rời đội 1–500, optional — ghi vào audit_logs.reason. */
  reason?: string | null;
}

/** DELETE /crews/:id/members/:memberId → soft-deactivate; đã inactive → alreadyRemoved:true. */
export type RemoveCrewMemberResult = CrewMember & {
  alreadyRemoved: boolean;
};

export type CrewLifecycleStatusChangeResult = Crew & {
  alreadyInState: boolean;
  warning?: { openAssignments: number } | null;
};

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

/**
 * Chuẩn hóa fieldErrors từ API shape
 * `{ statusCode, message, fieldErrors: { <field>: [msg] } }`. Trả undefined
 * khi shape lạ để caller fallback về message chung; an toàn cả hai shape.
 */
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

function classifyMessage(m: string): { field: string } | null {
  const lower = m.toLowerCase();
  if (lower.includes('mã đội') || (lower.includes('code') && !lower.includes('mã nhân viên'))) return { field: 'code' };
  if (lower.includes('tên đội') || lower.includes('name')) return { field: 'name' };
  if (lower.includes('mô tả') || lower.includes('description')) return { field: 'description' };
  if (lower.includes('trưởng nhóm') || lower.includes('leader')) return { field: 'leaderUserId' };
  if (lower.includes('nhà thầu') || lower.includes('contractor')) return { field: 'contractorId' };
  if (lower.includes('trạng thái') || lower.includes('status')) return { field: 'status' };
  if (lower.includes('lý do') || lower.includes('reason')) return { field: 'reason' };
  if (lower.includes('sắp xếp') || lower.includes('sort')) return { field: 'sort' };
  if (lower.includes('thứ tự') || lower.includes('order')) return { field: 'order' };
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
    if (msg) {
      // 409 trùng code / race lead → map về field để form hiển thị theo field.
      if (res.status === 409) {
        if (/(trưởng nhóm|đang hiệu lực|active lead)/i.test(msg)) {
          throw { status: res.status, message: msg, code, fieldErrors: { leaderUserId: [msg] }, traceId } satisfies ApiError;
        }
        if (/(đã tồn tại|duplicate|unique)/i.test(msg)) {
          const hit = classifyMessage(msg);
          throw { status: res.status, message: msg, code, fieldErrors: { [(hit?.field ?? 'code')]: [msg] }, traceId } satisfies ApiError;
        }
      }
      // Single-string 400 từ use case (reason policy) → map vào field reason.
      if (res.status === 400) {
        const hit = classifyMessage(msg);
        if (hit) {
          throw { status: res.status, message: msg, code, fieldErrors: { [hit.field]: [msg] }, traceId } satisfies ApiError;
        }
      }
      // API filter 400 shape { message, fieldErrors }: giữ nguyên fieldErrors server.
      throw { status: res.status, message: msg, code, fieldErrors: toFieldErrors(b.fieldErrors), traceId } satisfies ApiError;
    }
  }
  if (typeof body === 'string' && body.length > 0) {
    throw { status: res.status, message: body } satisfies ApiError;
  }
  throw { status: res.status, message: fallback } satisfies ApiError;
}

export async function listCrews(params: ListCrewsParams = {}): Promise<ListCrewsResult> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  if (params.eligibleOnly) qs.set('eligibleOnly', 'true');
  if (params.sort) qs.set('sort', params.sort);
  if (params.order) qs.set('order', params.order);
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  const url = `${base}/api/v1/crews${qs.toString() ? `?${qs.toString()}` : ''}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    await parseError(res, `Danh sách đội thi công thất bại (${res.status})`);
  }
  const data = (await res.json()) as ListCrewsResult;
  return data;
}

export async function getCrew(id: string): Promise<Crew> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/v1/crews/${encodeURIComponent(id)}`, {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    await parseError(res, `Lấy đội thi công thất bại (${res.status})`);
  }
  return (await res.json()) as Crew;
}

export async function createCrew(payload: CreateCrewPayload): Promise<Crew> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/v1/crews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Tạo đội thi công thất bại (${res.status})`);
  }
  return (await res.json()) as Crew;
}

export async function updateCrew(id: string, payload: UpdateCrewPayload): Promise<Crew> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/v1/crews/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Cập nhật đội thi công thất bại (${res.status})`);
  }
  return (await res.json()) as Crew;
}

/**
 * ORG-SRS-006 — lifecycle status: ACTIVATE/SUSPEND/TERMINATE.
 * SUSPEND/TERMINATE bắt buộc reason (1-500) — API trả 400 kèm message lý do
 * được parse về field `reason` để dialog hiển thị theo field.
 */
export async function changeCrewLifecycleStatus(
  id: string,
  payload: ChangeCrewLifecycleStatusPayload,
): Promise<CrewLifecycleStatusChangeResult> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/v1/crews/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Chuyển trạng thái đội thi công thất bại (${res.status})`);
  }
  const body = (await res.json()) as Record<string, unknown>;
  const { alreadyInState, warning, ...profile } = body;
  return {
    ...(profile as unknown as Crew),
    alreadyInState: alreadyInState === true,
    warning: warning && typeof warning === 'object'
      ? { openAssignments: Number((warning as { openAssignments?: unknown }).openAssignments ?? 0) }
      : null,
  };
}

/**
 * ORG-SRS-006 — pre-check open work (chỉ đếm cho confirm dialog,
 * không chặn, không audit).
 */
export async function getCrewOpenWork(id: string): Promise<OpenWorkResult> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/v1/crews/${encodeURIComponent(id)}/open-work`, {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    await parseError(res, `Kiểm tra công việc mở của đội thi công thất bại (${res.status})`);
  }
  const body = (await res.json()) as OpenWorkResult;
  return { openAssignments: Number(body.openAssignments ?? 0) };
}

/**
 * ORG-SRS-007 (issue #30) — tra cứu thành viên: default chỉ active,
 * `at` point-in-time roster, `includeInactive=true` toàn bộ lịch sử.
 * Reads dùng `cache: 'no-store'`; 400 shape { message, fieldErrors } giữ
 * nguyên fieldErrors server (pattern changeCrewLifecycleStatus).
 */
export async function listCrewMembers(id: string, params: ListCrewMembersParams = {}): Promise<ListCrewMembersResult> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const qs = new URLSearchParams();
  if (params.at) qs.set('at', params.at);
  if (params.includeInactive) qs.set('includeInactive', 'true');
  const url = `${base}/api/v1/crews/${encodeURIComponent(id)}/members${qs.toString() ? `?${qs.toString()}` : ''}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    await parseError(res, `Danh sách thành viên đội thi công thất bại (${res.status})`);
  }
  const data = (await res.json()) as ListCrewMembersResult;
  return data;
}

/**
 * ORG-SRS-007 (issue #30, D1) — thêm thành viên role MEMBER (201).
 * LEAD không qua đây. Lỗi: 409 MEMBER_DUPLICATE (code giữ nguyên để form
 * map về field userId) / CREW_INACTIVE / USER_INACTIVE, 404 USER_NOT_FOUND,
 * 400 fieldErrors (effectiveFrom). Thành công kèm warning? MEMBER_IN_OTHER_CREW
 * (overlap đội khác — vẫn thêm thành công, UI hiện banner).
 */
export async function addCrewMember(id: string, payload: AddCrewMemberPayload): Promise<AddCrewMemberResult> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/v1/crews/${encodeURIComponent(id)}/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Thêm thành viên đội thi công thất bại (${res.status})`);
  }
  const body = (await res.json()) as Record<string, unknown>;
  const { warning, ...member } = body;
  return {
    ...(member as unknown as CrewMember),
    warning: warning && typeof warning === 'object'
      ? {
        code: 'MEMBER_IN_OTHER_CREW' as const,
        otherCrews: Array.isArray((warning as { otherCrews?: unknown }).otherCrews)
          ? (warning as { otherCrews: OtherCrewRef[] }).otherCrews
          : [],
      }
      : null,
  };
}

/**
 * ORG-SRS-007 (issue #30, D2) — xóa mềm thành viên (giữ lịch sử).
 * Idempotent: đã inactive → 200 { alreadyRemoved: true }, không audit thêm.
 */
export async function removeCrewMember(
  id: string,
  memberId: string,
  payload: RemoveCrewMemberPayload = {},
): Promise<RemoveCrewMemberResult> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/v1/crews/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Xóa thành viên đội thi công thất bại (${res.status})`);
  }
  const body = (await res.json()) as Record<string, unknown>;
  const { alreadyRemoved, ...member } = body;
  return {
    ...(member as unknown as CrewMember),
    alreadyRemoved: alreadyRemoved === true,
  };
}
