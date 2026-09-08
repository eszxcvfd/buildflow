/**
 * PRJ-SRS-009 (issue #40) — project attachments API client (Web part).
 *
 * Contract: ENDPOINTS §18 — project-scoped:
 * - POST /api/v1/projects/:id/attachments: multipart `file` (bắt buộc) +
 *   `caption?` (≤500) + `requestKey?` (uuid); `201` profile (`200` +
 *   `idempotentReplay: true` khi `requestKey` trùng). Write-scope
 *   (ADMIN bypass hoặc ACTIVE member MANAGER/COORDINATOR); non-member 403
 *   (kể cả project missing).
 * - GET /api/v1/projects/:id/attachments: `{ data[], total }`, `no-store`;
 *   member-scope (bất kỳ ACTIVE member nào).
 * - GET .../:attId/content: bytes download, member-scope; UI tải qua blob
 *   objectURL — KHÔNG đặt token trong URL.
 * - PATCH .../:attId/retire `{ reason? }` (≤500) → profile +
 *   `alreadyInactive` khi đã retire (không mutation, không audit).
 *
 * Upload dùng `fetch` + `FormData` — KHÔNG set `Content-Type` thủ công
 * (browser tự sinh boundary). Server là source of truth cho validate
 * (loại/size ≤10MB); client pre-check chỉ để báo sớm. Strict
 * `X-Correlation-Id` trên writes (POST/PATCH — sai UUID → 400; GET miễn),
 * mirror work-orders.ts. `requestKey` do dialog sinh MỘT lần mỗi phiên mở
 * (retry trong phiên giữ nguyên key → replay không tạo trùng).
 */

export interface Attachment {
  id: string;
  projectId: string;
  workOrderId: string | null;
  ownerType: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption: string | null;
  isActive: boolean;
  deactivatedAt: string | null;
  deactivatedBy: string | null;
  deactivateReason: string | null;
  createdAt: string;
}

export interface ListAttachmentsResult {
  data: Attachment[];
  total: number;
}

export interface UploadAttachmentPayload {
  file: File | Blob;
  fileName?: string;
  caption?: string | null;
  requestKey?: string | null;
}

export interface UploadAttachmentOptions {
  /** Override correlation id (mặc định tự sinh UUID mỗi lần gửi). */
  correlationId?: string;
}

export interface UploadAttachmentResult {
  attachment: Attachment;
  /** true khi server replay requestKey trùng (200, không tạo bản ghi mới). */
  idempotentReplay: boolean;
}

export interface RetireAttachmentResult {
  attachment: Attachment;
  /** true khi đã retire trước đó (không mutation, không audit mới). */
  alreadyInactive: boolean;
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
  fieldErrors?: Record<string, string[]>;
  traceId?: string;
}

/** Loại file client cho phép chọn — mirror allowlist server (§18 AT3). */
export const ATTACHMENT_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

/** Giới hạn kích thước file — mirror server (§18 AT3). */
export const ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024;

/** Caption/reason tối đa — mirror server (§18 AT3/AT5). */
export const ATTACHMENT_TEXT_MAX_LENGTH = 500;

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

/** Sinh UUID v4 cho X-Correlation-Id / requestKey (mirror work-orders.ts). */
export function newAttachmentUuid(): string {
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

export function newCorrelationId(): string {
  return newAttachmentUuid();
}

export function newRequestKey(): string {
  return newAttachmentUuid();
}

function classifyMessage(m: string): { field: string } | null {
  const lower = m.toLowerCase();
  if (lower.includes('x-correlation')) return { field: '_global' };
  if (lower.includes('request key') || lower.includes('requestkey')) return { field: 'requestKey' };
  if (lower.includes('caption')) return { field: 'caption' };
  if (lower.includes('lý do') || lower.includes('reason')) return { field: 'reason' };
  if (
    lower.includes('loại file') ||
    lower.includes('file type') ||
    lower.includes('mime') ||
    lower.includes('loại tệp') ||
    lower.includes('được phê duyệt') ||
    lower.includes('magic')
  ) {
    return { field: 'file' };
  }
  if (
    lower.includes('quá lớn') ||
    lower.includes('quá hạn') ||
    lower.includes('10mb') ||
    lower.includes('kích thước') ||
    lower.includes('size')
  ) {
    return { field: 'file' };
  }
  if (lower.includes('file') || lower.includes('tệp')) return { field: 'file' };
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
        else if (typeof v === 'string') fieldErrors[k] = [v];
      }
      const msg = typeof b.message === 'string' ? b.message : fallback;
      const code = typeof b.code === 'string' ? b.code : undefined;
      const traceId = typeof b.traceId === 'string' ? b.traceId : undefined;
      throw { status: res.status, message: msg, code, fieldErrors, traceId } satisfies ApiError;
    }
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

function writeHeaders(correlationId: string): Record<string, string> {
  const token = getAuthToken();
  return {
    // KHÔNG set Content-Type: browser tự sinh multipart boundary.
    Accept: 'application/json',
    'X-Correlation-Id': correlationId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * PRJ-SRS-009 — tải file lên dự án (multipart `file` + `caption?` +
 * `requestKey?`). `201` → replay false; `200` + `idempotentReplay` → true.
 * Lỗi: 400 fieldErrors.file (thiếu/sai loại/quá 10MB), fieldErrors.caption,
 * 403 ngoài scope, 401 hết phiên.
 */
export async function uploadAttachment(
  projectId: string,
  payload: UploadAttachmentPayload,
  opts: UploadAttachmentOptions = {},
): Promise<UploadAttachmentResult> {
  const base = getApiBaseUrl();
  const correlationId = opts.correlationId ?? newCorrelationId();
  const form = new FormData();
  const fileValue = payload.fileName ? new File([payload.file], payload.fileName, { type: (payload.file as File).type }) : payload.file;
  form.append('file', fileValue);
  if (payload.caption != null && payload.caption !== '') form.append('caption', payload.caption);
  if (payload.requestKey) form.append('requestKey', payload.requestKey);
  const res = await fetch(`${base}/api/v1/projects/${encodeURIComponent(projectId)}/attachments`, {
    method: 'POST',
    headers: writeHeaders(correlationId),
    body: form,
  });
  if (!res.ok) {
    await parseError(res, `Tải lên tài liệu thất bại (${res.status})`);
  }
  const data = (await res.json()) as Attachment & { idempotentReplay?: boolean };
  const { idempotentReplay, ...attachment } = data;
  return { attachment: attachment as Attachment, idempotentReplay: idempotentReplay === true };
}

/**
 * PRJ-SRS-009 — liệt kê tài liệu của dự án (metadata cả active + inactive).
 * Dùng `cache: 'no-store'`; 403 non-member, 401 hết phiên.
 */
export async function listAttachments(projectId: string): Promise<ListAttachmentsResult> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/projects/${encodeURIComponent(projectId)}/attachments`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    await parseError(res, `Lấy danh sách tài liệu thất bại (${res.status})`);
  }
  return (await res.json()) as ListAttachmentsResult;
}

export interface DownloadAttachmentResult {
  blob: Blob;
  contentType: string | null;
  fileName: string | null;
}

function fileNameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  return m?.[1] ? decodeURIComponent(m[1].trim()) : null;
}

/**
 * PRJ-SRS-009 — tải nội dung file về dạng Blob (member-scope). Caller tạo
 * objectURL để trigger download — KHÔNG đặt token trong URL.
 */
export async function downloadAttachment(projectId: string, attachmentId: string): Promise<DownloadAttachmentResult> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const res = await fetch(
    `${base}/api/v1/projects/${encodeURIComponent(projectId)}/attachments/${encodeURIComponent(attachmentId)}/content`,
    {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    },
  );
  if (!res.ok) {
    await parseError(res, `Tải xuống tài liệu thất bại (${res.status})`);
  }
  const blob = await res.blob();
  return {
    blob,
    contentType: res.headers.get('content-type'),
    fileName: fileNameFromContentDisposition(res.headers.get('content-disposition')),
  };
}

/**
 * PRJ-SRS-009 — ngừng sử dụng tài liệu (`200` profile; `alreadyInactive`
 * khi đã retire — không mutation, không audit mới). Lỗi: 400
 * fieldErrors.reason (quá 500), 403 ngoài scope, 404 att missing/khác project.
 */
export async function retireAttachment(
  projectId: string,
  attachmentId: string,
  payload: { reason?: string | null } = {},
  opts: UploadAttachmentOptions = {},
): Promise<RetireAttachmentResult> {
  const base = getApiBaseUrl();
  const token = getAuthToken();
  const correlationId = opts.correlationId ?? newCorrelationId();
  const res = await fetch(
    `${base}/api/v1/projects/${encodeURIComponent(projectId)}/attachments/${encodeURIComponent(attachmentId)}/retire`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json',
        'X-Correlation-Id': correlationId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ...(payload.reason != null ? { reason: payload.reason } : {}) }),
    },
  );
  if (!res.ok) {
    await parseError(res, `Ngừng sử dụng tài liệu thất bại (${res.status})`);
  }
  const data = (await res.json()) as Attachment & { alreadyInactive?: boolean };
  const { alreadyInactive, ...attachment } = data;
  return { attachment: attachment as Attachment, alreadyInactive: alreadyInactive === true };
}
