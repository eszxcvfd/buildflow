/**
 * JOB-SRS-004 (issue #44) — Job Board open/close API client (Web part).
 *
 * Contract: WorkOrdersController (ENDPOINTS §19) —
 * POST /api/v1/work-orders/:id/job-board/open |
 * POST /api/v1/work-orders/:id/job-board/close (luôn `200`).
 * - Auth: Bearer từ `buildflow.auth.v1` (mirror `work-orders.ts`).
 * - Strict `X-Correlation-Id` UUID: client luôn tự sinh mỗi lần gửi, cho
 *   phép override qua opts để test/retry có kiểm soát (mirror `work-orders.ts:153,315`).
 * - Lỗi giữ nguyên shape `{ status, message, code?, fieldErrors?, traceId? }`
 *   (pattern `work-orders.ts`/`work-order-readiness.ts`); `fieldErrors`
 *   (`JOB_BOARD_WINDOW_INVALID`) được UI render đúng dưới từng input.
 */

import { newCorrelationId, type ApiError, type WorkOrder } from './work-orders';

export interface OpenJobBoardPayload {
  jobBoardOpenFrom?: string | null;
  jobBoardOpenUntil?: string | null;
  expectedVersion?: number;
  reason?: string | null;
}

export interface CloseJobBoardPayload {
  expectedVersion?: number;
  reason?: string | null;
}

export interface JobBoardOptions {
  /** Override correlation id (mặc định tự sinh UUID mỗi lần gửi). */
  correlationId?: string;
}

export interface OpenJobBoardResult {
  workOrder: WorkOrder;
  /** true khi server replay cùng window (200, không tx/audit mới). */
  alreadyOpen: boolean;
}

export interface CloseJobBoardResult {
  workOrder: WorkOrder;
  /** true khi board đã đóng (200, không tx/audit mới). */
  alreadyClosed: boolean;
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
    // F026 — stock-Nest 400 shape `{ message: string[], statusCode }`: mirror
    // `work-orders.ts:257-266` để không mất code/fieldErrors.
    if (Array.isArray(b.message)) {
      const fieldErrors: Record<string, string[]> = {};
      for (const m of b.message as unknown[]) {
        if (typeof m !== 'string') continue;
        fieldErrors._global = [...(fieldErrors._global ?? []), m];
      }
      throw { status: res.status, message: (b.message as unknown[]).filter((x): x is string => typeof x === 'string').join('; ') || fallback, code, fieldErrors, traceId } satisfies ApiError;
    }
    if (msg) {
      throw {
        status: res.status,
        message: msg,
        code,
        fieldErrors: toFieldErrors(b.fieldErrors),
        traceId,
      } satisfies ApiError;
    }
  }
  if (typeof body === 'string' && body.length > 0) {
    throw { status: res.status, message: body } satisfies ApiError;
  }
  throw { status: res.status, message: fallback } satisfies ApiError;
}

async function postJobBoardCommand(
  id: string,
  action: 'open' | 'close',
  payload: OpenJobBoardPayload | CloseJobBoardPayload,
  opts: JobBoardOptions,
  fallback: string,
): Promise<WorkOrder & { alreadyOpen?: boolean; alreadyClosed?: boolean }> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const correlationId = opts.correlationId ?? newCorrelationId();
  let res: Response;
  try {
    res = await fetch(`${base}/api/v1/work-orders/${encodeURIComponent(id)}/job-board/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json',
        'X-Correlation-Id': correlationId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // F010 — lỗi mạng (fetch reject): ném ApiError để UI hiện Alert chung,
    // không crash (status 0 = chưa có HTTP response).
    throw { status: 0, message: 'Không thể kết nối tới máy chủ, vui lòng kiểm tra mạng và thử lại' } satisfies ApiError;
  }
  if (!res.ok) {
    await parseError(res, fallback);
  }
  try {
    return (await res.json()) as WorkOrder & { alreadyOpen?: boolean; alreadyClosed?: boolean };
  } catch {
    // F010 — body 2xx parse không ra JSON: ném ApiError thay vì SyntaxError thô.
    throw { status: res.status, message: fallback } satisfies ApiError;
  }
}

/**
 * JOB-SRS-004 — mở Job Board (`200`; replay cùng window →
 * `alreadyOpen: true`, không tx/audit mới).
 * Lỗi: 400 `JOB_BOARD_WINDOW_INVALID` (fieldErrors jobBoardOpenFrom/Until) /
 * `WORK_ORDER_NOT_PUBLISHABLE` (+unmet) / `WORK_ORDER_STATUS_NOT_OPENABLE`;
 * 409 `JOB_BOARD_ALREADY_OPEN` / `JOB_BOARD_HAS_ASSIGNEE` / `WORK_ORDER_CONFLICT`;
 * 403 ngoài scope, 401 hết phiên.
 */
export async function openJobBoard(
  id: string,
  payload: OpenJobBoardPayload = {},
  opts: JobBoardOptions = {},
): Promise<OpenJobBoardResult> {
  const data = await postJobBoardCommand(id, 'open', payload, opts, `Mở Job Board thất bại`);
  const { alreadyOpen, ...workOrder } = data;
  return { workOrder: workOrder as WorkOrder, alreadyOpen: alreadyOpen === true };
}

/**
 * JOB-SRS-004 — đóng Job Board (`200`; đã đóng →
 * `alreadyClosed: true`, không tx/audit mới; assignment KHÔNG bị hủy).
 * Lỗi: 409 `WORK_ORDER_CONFLICT`; 403 ngoài scope, 401 hết phiên.
 */
export async function closeJobBoard(
  id: string,
  payload: CloseJobBoardPayload = {},
  opts: JobBoardOptions = {},
): Promise<CloseJobBoardResult> {
  const data = await postJobBoardCommand(id, 'close', payload, opts, `Đóng Job Board thất bại`);
  const { alreadyClosed, ...workOrder } = data;
  return { workOrder: workOrder as WorkOrder, alreadyClosed: alreadyClosed === true };
}
