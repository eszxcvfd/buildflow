/**
 * JOB-SRS-001 (issue #41) — work-orders API client (Web part).
 *
 * Contract: WorkOrdersController (ENDPOINTS §17) — POST tạo nháp + GET chi tiết
 * + PATCH cập nhật (JOB-SRS-003 #43).
 * - POST /api/v1/work-orders: scope-first write (ADMIN bypass hoặc ACTIVE member
 *   MANAGER/COORDINATOR); strict `X-Correlation-Id` (client luôn tự sinh UUID
 *   mỗi lần gửi, cho phép override qua opts để test/retry có kiểm soát);
 *   `requestKey` do dialog sinh MỘT lần mỗi phiên mở (replay cùng key →
 *   `200` + `idempotentReplay: true`, không tạo bản ghi mới).
 * - GET /api/v1/work-orders/:id: bất kỳ ACTIVE member nào của project chứa WO
 *   (kể cả WORKER) + ADMIN bypass; non-member 403 (không leak 404).
 * GET dùng `cache: 'no-store'`; lỗi 400 shape mới `{ message, fieldErrors }`
 * được giữ nguyên fieldErrors (pattern work-types/crews/trades).
 */

export type WorkOrderPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface WorkOrder {
  id: string;
  code: string;
  projectId: string;
  /** Tên dự án do API kèm trong list (batch `findProjectRefs`) — `null`/absent → fallback id rút gọn. */
  projectName?: string | null;
  areaId: string | null;
  workTypeId: string;
  workTypeName?: string | null;
  requiredTradeId: string | null;
  title: string;
  description: string | null;
  instructions: string | null;
  priority: WorkOrderPriority | string;
  status: 'DRAFT' | string;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  /** Hạn hoàn thành (`due_at`) — đọc + PATCH #43 (create để null). */
  dueAt: string | null;
  plannedHeadcount: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CreateWorkOrderPayload {
  projectId: string;
  workTypeId: string;
  title: string;
  areaId?: string | null;
  requiredTradeId?: string | null;
  code?: string | null;
  description?: string | null;
  instructions?: string | null;
  priority?: WorkOrderPriority;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  plannedHeadcount?: number | null;
  requestKey?: string | null;
}

export interface CreateWorkOrderOptions {
  /** Override correlation id (mặc định tự sinh UUID mỗi lần gửi). */
  correlationId?: string;
}

/**
 * JOB-SRS-003 (issue #43) — payload PATCH /api/v1/work-orders/:id.
 * Mọi field optional (absent = không đụng); `requiredTradeId: null` = gỡ skill.
 * `status`/`title`/`code` KHÔNG thuộc whitelist (server 400 forbidNonWhitelisted).
 */
export interface UpdateWorkOrderPayload {
  description?: string | null;
  instructions?: string | null;
  priority?: WorkOrderPriority;
  dueAt?: string | null;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  requiredTradeId?: string | null;
  workTypeId?: string;
  expectedVersion?: number;
  reason?: string | null;
}

export interface UpdateWorkOrderOptions {
  /** Override correlation id (mặc định tự sinh UUID mỗi lần gửi — strict như POST). */
  correlationId?: string;
}

export interface CreateWorkOrderResult {
  workOrder: WorkOrder;
  /** true khi server replay requestKey trùng (200, không tạo bản ghi mới). */
  idempotentReplay: boolean;
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
  fieldErrors?: Record<string, string[]>;
  traceId?: string;
}

export type WorkOrderListStatus =
  | 'DRAFT'
  | 'READY'
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WORK_DONE'
  | 'CLOSED'
  | 'CANCELLED';

export interface SearchWorkOrdersParams {
  projectId?: string;
  status?: WorkOrderListStatus | 'ALL';
  search?: string;
  limit?: number;
  offset?: number;
}

export interface SearchWorkOrdersResult {
  data: WorkOrder[];
  total: number;
  limit: number;
  offset: number;
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

/** Sinh UUID v4 cho X-Correlation-Id (POST strict) khi caller không override. */
export function newCorrelationId(): string {
  try {
    const c = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined;
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    /* fallback bên dưới */
  }
  const hex = '0123456789abcdef';
  const pick = () => hex[Math.floor(Math.random() * 16)];
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
    else if (i === 14) out += '4';
    else if (i === 19) out += hex[(Math.floor(Math.random() * 4) + 8) % 16];
    else out += pick();
  }
  return out;
}

function classifyMessage(m: string): { field: string } | null {
  const lower = m.toLowerCase();
  if (lower.includes('x-correlation')) return { field: '_global' };
  if (lower.includes('request key') || lower.includes('requestkey')) return { field: 'requestKey' };
  if (lower.includes('dự án') || lower.includes('projectid')) return { field: 'projectId' };
  if (lower.includes('loại công việc') || lower.includes('worktype')) return { field: 'workTypeId' };
  if (lower.includes('khu vực') || lower.includes('areaid')) return { field: 'areaId' };
  if (lower.includes('ngành nghề') || lower.includes('requiredtrade') || lower.includes('tradeid')) {
    return { field: 'requiredTradeId' };
  }
  if (lower.includes('tiêu đề') || lower.includes('tieu de') || lower.includes('title')) return { field: 'title' };
  if (lower.includes('mã công việc') || lower.includes('ma cong viec') || lower.includes('work_order_code_duplicate')) {
    return { field: 'code' };
  }
  if (lower.includes('mã') || lower.includes('code')) return { field: 'code' };
  if (lower.includes('hướng dẫn') || lower.includes('instructions')) return { field: 'instructions' };
  if (lower.includes('mô tả') || lower.includes('description')) return { field: 'description' };
  if (lower.includes('ưu tiên') || lower.includes('priority')) return { field: 'priority' };
  if (lower.includes('kết thúc') || lower.includes('plannedendat') || lower.includes('start < end')) {
    return { field: 'plannedEndAt' };
  }
  if (lower.includes('bắt đầu') || lower.includes('plannedstartat')) return { field: 'plannedStartAt' };
  if (lower.includes('planned')) return { field: 'plannedEndAt' };
  if (lower.includes('số người') || lower.includes('headcount')) return { field: 'plannedHeadcount' };
  if (lower.includes('hạn hoàn thành') || lower.includes('dueat') || lower.includes('due_at')) {
    return { field: 'dueAt' };
  }
  if (lower.includes('lý do') || lower.includes('reason')) return { field: 'reason' };
  if (
    lower.includes('khóa ở trạng thái') || lower.includes('field_locked') || lower.includes('field locked') ||
    lower.includes('khóa') || lower.includes('locked')
  ) {
    return { field: '_locked' };
  }
  if (
    lower.includes('phiên bản') || lower.includes('version') || lower.includes('conflict') ||
    lower.includes('người khác cập nhật') || lower.includes('work_order_conflict')
  ) {
    return { field: 'expectedVersion' };
  }
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
    // Single-string errors từ use case (400 domain rule, 409 trùng code) —
    // map về field để UI hiển thị đúng input.
    if (msg) {
      if (
        res.status === 409 &&
        (code === 'WORK_ORDER_CONFLICT' ||
          /(xung đột|người khác cập nhật|version|conflict)/i.test(msg))
      ) {
        throw {
          status: res.status,
          message: msg,
          code,
          fieldErrors: { expectedVersion: [msg] },
          traceId,
        } satisfies ApiError;
      }
      if (
        res.status === 409 &&
        (code === 'WORK_ORDER_CODE_DUPLICATE' || /(đã tồn tại|duplicate|unique|trùng)/i.test(msg))
      ) {
        const hit = classifyMessage(msg);
        throw {
          status: res.status,
          message: msg,
          code,
          fieldErrors: { [hit?.field ?? 'code']: [msg] },
          traceId,
        } satisfies ApiError;
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

/**
 * JOB-SRS-001 — tạo Work Order nháp (`201`; replay requestKey trùng →
 * `200` + `idempotentReplay: true`). Lỗi: 400 fieldErrors (workTypeId /
 * areaId / requiredTradeId / plannedEndAt / title / code…), 409
 * WORK_ORDER_CODE_DUPLICATE (fieldErrors.code), 403 ngoài scope, 401 hết phiên.
 */
export async function createWorkOrder(
  payload: CreateWorkOrderPayload,
  opts: CreateWorkOrderOptions = {},
): Promise<CreateWorkOrderResult> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const correlationId = opts.correlationId ?? newCorrelationId();
  const res = await fetch(`${base}/api/v1/work-orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      'X-Correlation-Id': correlationId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Tạo work order thất bại (${res.status})`);
  }
  const data = (await res.json()) as WorkOrder & { idempotentReplay?: boolean };
  const { idempotentReplay, ...workOrder } = data;
  return { workOrder: workOrder as WorkOrder, idempotentReplay: idempotentReplay === true };
}

/**
 * JOB-SRS-001 — đọc chi tiết Work Order (member của project chứa WO đọc được,
 * kể cả WORKER; non-member 403, không leak 404).
 */
export async function getWorkOrder(id: string): Promise<WorkOrder> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/work-orders/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    await parseError(res, `Lấy work order thất bại (${res.status})`);
  }
  return (await res.json()) as WorkOrder;
}

/**
 * Danh sách Work Order (`GET /api/v1/work-orders`, `{ data, total, limit,
 * offset }`, `cache: 'no-store'`). Scope server-side: ADMIN = tất cả,
 * non-ADMIN = WO các project mình là ACTIVE member; `projectId` ngoài scope
 * → 403; lỗi 400 shape `{ message, fieldErrors }` giữ nguyên fieldErrors.
 */
export async function searchWorkOrders(
  params: SearchWorkOrdersParams = {},
): Promise<SearchWorkOrdersResult> {
  const base = getApiBaseUrl();
  const qs = new URLSearchParams();
  if (params.projectId) qs.set('projectId', params.projectId);
  if (params.status && params.status !== 'ALL') qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  const url = `${base}/api/v1/work-orders${qs.toString() ? `?${qs.toString()}` : ''}`;
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
  if (!res.ok) {
    await parseError(res, `Tải danh sách công việc thất bại (${res.status})`);
  }
  return (await res.json()) as SearchWorkOrdersResult;
}
/**
 * JOB-SRS-003 (issue #43) — cập nhật Work Order (`200`, `version` +1).
 * Gửi `expectedVersion` (optimistic lock → 409 WORK_ORDER_CONFLICT,
 * fieldErrors.expectedVersion) + `reason` khi đổi lịch/skill/work-type
 * (thiếu → 400 WORK_ORDER_REASON_REQUIRED, fieldErrors.reason).
 * Field khóa per-state → 400 WORK_ORDER_FIELD_LOCKED (giữ nguyên fieldErrors
 * từng field để dialog hiển thị đúng input). Strict `X-Correlation-Id` như POST.
 */
export async function updateWorkOrder(
  id: string,
  payload: UpdateWorkOrderPayload,
  opts: UpdateWorkOrderOptions = {},
): Promise<WorkOrder> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const correlationId = opts.correlationId ?? newCorrelationId();
  const res = await fetch(`${base}/api/v1/work-orders/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      'X-Correlation-Id': correlationId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Cập nhật work order thất bại (${res.status})`);
  }
  return (await res.json()) as WorkOrder;
}
