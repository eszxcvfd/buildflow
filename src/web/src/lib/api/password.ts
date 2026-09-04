/**
 * IAM-SRS-007 (GitHub issue #22): change password + reset password API client.
 * Contract đã chốt với backend:
 * - PATCH /api/v1/me/password: body { currentPassword, newPassword, confirmPassword } — confirmPassword bắt buộc;
 *   sai currentPassword → 400 kèm fieldErrors.currentPassword; 401 chỉ xảy ra khi chưa xác thực/session hết hạn.
 * - POST /api/v1/auth/password-reset/confirm: body { token, newPassword, confirmPassword }; token invalid/used/expired → 401.
 * - POST /api/v1/auth/password-reset/request: response LUÔN { message } generic (anti-enumeration) — không còn resetUrl.
 * Never stores passwords/tokens in persistent storage; tokens only in memory/URL per SRS.
 */

export interface PasswordActionError extends Error {
  status: number;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

/** Build a real Error with status + fieldErrors attached (catchable as PasswordActionError). */
function makeError(status: number, message: string, fieldErrors?: Record<string, string[]>): PasswordActionError {
  const e = new Error(message) as PasswordActionError;
  e.name = 'PasswordActionError';
  e.status = status;
  if (fieldErrors) e.fieldErrors = fieldErrors;
  return e;
}

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
}

const KNOWN_FIELDS = ['currentPassword', 'newPassword', 'confirmPassword', 'token'] as const;

/**
 * Classify a single validation/business message into a field by keyword.
 * Covers both English property names (class-validator) and Vietnamese use-case messages.
 */
function classifyMessage(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('currentpassword') || lower.includes('mật khẩu hiện tại') || lower.includes('hiện tại')) return 'currentPassword';
  if (lower.includes('confirmpassword') || lower.includes('xác nhận')) return 'confirmPassword';
  if (lower.includes('newpassword') || lower.includes('mật khẩu mới') || lower.includes('mật khẩu') || lower.includes('chữ số') || lower.includes('chữ cái') || lower.includes('tối thiểu 8')) return 'newPassword';
  if (lower.includes('token')) return 'token';
  return '_global';
}

function push(fe: Record<string, string[]>, field: string, msg: string): void {
  fe[field] = [...(fe[field] ?? []), msg];
}

/**
 * Extract field errors from an error body. Handles both shapes in the contract:
 * - NestJS ValidationPipe 400: body.message is an ARRAY of strings → classify by keyword, fallback _global.
 * - Use-case business error: body = { message, errors: { field: msg | msg[] } } → map by field key.
 */
export function extractFieldErrors(body: unknown): Record<string, string[]> | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const b = body as Record<string, unknown>;
  const fe: Record<string, string[]> = {};

  const consumeMessage = (raw: unknown) => {
    if (typeof raw === 'string') {
      push(fe, classifyMessage(raw), raw);
    } else if (Array.isArray(raw)) {
      for (const item of raw) consumeMessage(item);
    }
  };

  // Shape 1: body.message string | string[]
  consumeMessage(b.message);

  // Shape 2: body.errors = { field: msg | msg[] }
  if (b.errors && typeof b.errors === 'object' && !Array.isArray(b.errors)) {
    for (const [rawKey, value] of Object.entries(b.errors as Record<string, unknown>)) {
      const key = rawKey.toLowerCase();
      const known = KNOWN_FIELDS.find((f) => f.toLowerCase() === key);
      const msgs = Array.isArray(value) ? value : [value];
      for (const m of msgs) {
        if (typeof m !== 'string') continue;
        push(fe, known ?? classifyMessage(m), m);
      }
    }
  }

  return Object.keys(fe).length > 0 ? fe : undefined;
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const ct = res.headers.get('content-type') ?? '';
  const body: unknown = ct.includes('application/json') ? await res.json().catch(() => null) : await res.text().catch(() => null);
  // Per contract, field-level errors only come with 400; 401 means dead session / bad reset token → plain message.
  const fieldErrors = res.status === 400 ? extractFieldErrors(body) : undefined;
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    let msg: string | undefined;
    if (typeof b.message === 'string') msg = b.message;
    else if (Array.isArray(b.message)) msg = fieldErrors?._global?.[0] ?? fallback;
    else if (b.message && typeof b.message === 'object' && typeof (b.message as { message?: unknown }).message === 'string') msg = (b.message as { message: string }).message;
    else if (typeof b.error === 'string') msg = b.error;
    throw makeError(res.status, msg ?? fallback, fieldErrors);
  }
  if (typeof body === 'string' && body.length > 0) throw makeError(res.status, body);
  throw makeError(res.status, fallback);
}

/** fetch wrapper: network failure (offline/DNS/CORS) → PasswordActionError with fallback message instead of raw TypeError. */
async function request(url: string, init: RequestInit, fallback: string): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw makeError(0, fallback);
  }
}

function authHeader(token: string | null): HeadersInit {
  return { Accept: 'application/json', 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export async function changePassword(
  token: string | null,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): Promise<{ message: string; reauthRequired: boolean }> {
  const res = await request(
    `${getApiBaseUrl()}/api/v1/me/password`,
    { method: 'PATCH', headers: authHeader(token), body: JSON.stringify({ currentPassword, newPassword, confirmPassword }) },
    'Đổi mật khẩu thất bại',
  );
  if (!res.ok) await parseError(res, 'Đổi mật khẩu thất bại');
  return res.json();
}

/** Always resolves with the same generic { message } regardless of email existence (anti-enumeration, no resetUrl). */
export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const res = await request(
    `${getApiBaseUrl()}/api/v1/auth/password-reset/request`,
    { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ email }) },
    'Gửi yêu cầu thất bại',
  );
  if (!res.ok) await parseError(res, 'Gửi yêu cầu thất bại');
  const data = (await res.json().catch(() => null)) as { message?: unknown } | null;
  // Anti-enumeration: the client only ever consumes the generic message —
  // any extra key (e.g. a legacy/stray resetUrl) is intentionally dropped.
  return { message: typeof data?.message === 'string' ? data.message : '' };
}

export async function confirmPasswordReset(token: string, newPassword: string, confirmPassword: string): Promise<{ message: string; reauthRequired: boolean }> {
  const res = await request(
    `${getApiBaseUrl()}/api/v1/auth/password-reset/confirm`,
    { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ token, newPassword, confirmPassword }) },
    'Đặt lại mật khẩu thất bại',
  );
  if (!res.ok) await parseError(res, 'Đặt lại mật khẩu thất bại');
  return res.json();
}
