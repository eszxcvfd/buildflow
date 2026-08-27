import type { StoredAuth } from '@/lib/auth/storage';

export interface LoginPayload {
  email: string;
  password: string;
}

export type LoginSuccess = StoredAuth;

export interface FieldErrors {
  [field: string]: string[];
}

export interface LoginError {
  status: number;
  code?: string;
  message: string;
  fieldErrors?: FieldErrors;
  traceId?: string;
}

export interface LogoutError {
  status: number;
  message: string;
  code?: string;
  traceId?: string;
}

/**
 * Calls POST /api/v1/auth/logout with Authorization: Bearer <token> per IAM-SRS-002.
 * Producer contract: 200 on success, 401 "Phiên hết hạn, vui lòng đăng nhập lại" when token missing/expired/revoked/missing jti.
 * Client is idempotent: caller should clearAuth regardless of 200 or 401.
 */
export async function logoutRequest(token: string): Promise<void> {
  const base = getApiBaseUrl();
  const url = `${base}/api/v1/auth/logout`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=utf-8',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.ok) return;

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const body: unknown = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);
  // Map similarly to login error but for logout 401 is expected idempotent path
  const fallback = res.status === 401 ? 'Phiên hết hạn, vui lòng đăng nhập lại' : `Yêu cầu thất bại (${res.status})`;
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const msg = typeof b.message === 'string' ? b.message : typeof b.error === 'string' ? b.error : undefined;
    const code = typeof b.code === 'string' ? b.code : undefined;
    const traceId = typeof b.traceId === 'string' ? b.traceId : undefined;
    throw { status: res.status, message: msg ?? fallback, code, traceId } satisfies LogoutError;
  }
  if (typeof body === 'string' && body.length > 0) {
    throw { status: res.status, message: body } satisfies LogoutError;
  }
  throw { status: res.status, message: fallback } satisfies LogoutError;
}

/**
 * Calls POST /api/v1/auth/login with JSON UTF-8 per NETCODE.md.
 * Maps contract error labels:
 *  - 400 validation
 *  - 401 generic "Thông tin đăng nhập không hợp lệ" or "Phiên hết hạn, vui lòng đăng nhập lại"
 *  - 403 "Tài khoản đã ngừng hoạt động" / "Tài khoản đang bị khóa"
 */
export async function loginRequest(payload: LoginPayload): Promise<LoginSuccess> {
  const base = getApiBaseUrl();
  const url = `${base}/api/v1/auth/login`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email: payload.email, password: payload.password }),
  });

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const body: unknown = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (res.ok) {
    // Expected shape: { accessToken, expiresAt, user, roles, projectIds }
    const data = body as Record<string, unknown>;
    if (
      typeof data?.accessToken === 'string' &&
      typeof data?.expiresAt === 'string' &&
      typeof data?.user === 'object' &&
      Array.isArray((data as { roles?: unknown }).roles) &&
      Array.isArray((data as { projectIds?: unknown }).projectIds)
    ) {
      return data as unknown as LoginSuccess;
    }
    throw {
      status: 500,
      message: 'Phản hồi đăng nhập không hợp lệ',
    } satisfies LoginError;
  }

  // Error mapping per contract
  return mapLoginError(res.status, body);
}

function getApiBaseUrl(): string {
  // WEB.md: API_INTERNAL_URL is server-only/private env; browser must not use it
  // loginRequest is called from Client Component (LoginForm), so in browser we must
  // prioritize NEXT_PUBLIC_API_URL. Only when running on server (window undefined)
  // we may use API_INTERNAL_URL (e.g., docker internal hostname).
  if (typeof window === 'undefined') {
    return process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
}

function mapLoginError(status: number, body: unknown): never {
  const fallback: Record<number, string> = {
    400: 'Dữ liệu không hợp lệ',
    401: 'Thông tin đăng nhập không hợp lệ',
    403: 'Tài khoản bị hạn chế',
  };

  // Nest ValidationPipe / API ProblemDetails-inspired shape
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const messageRaw = b.message;
    const errorRaw = b.error;
    const detail = typeof b.detail === 'string' ? b.detail : undefined;
    const code = typeof b.code === 'string' ? b.code : undefined;
    const traceId = typeof b.traceId === 'string' ? b.traceId : undefined;

    // Validation errors: { message: string[], error: 'Bad Request', statusCode: 400 }
    if (status === 400) {
      const fieldErrors: FieldErrors = {};
      if (Array.isArray(messageRaw)) {
        // class-validator returns array of strings; map to generic field if possible
        // Heuristic: messages containing "Email" -> email, "Mật khẩu"/"password" -> password
        for (const msg of messageRaw as unknown[]) {
          if (typeof msg !== 'string') continue;
          const lower = msg.toLowerCase();
          if (lower.includes('email')) {
            fieldErrors.email = [...(fieldErrors.email ?? []), msg];
          } else if (lower.includes('password') || lower.includes('mật khẩu')) {
            fieldErrors.password = [...(fieldErrors.password ?? []), msg];
          } else {
            fieldErrors._global = [...(fieldErrors._global ?? []), msg];
          }
        }
        throw {
          status,
          code,
          message: (fieldErrors._global?.[0] as string) ?? 'Dữ liệu không hợp lệ',
          fieldErrors,
          traceId,
        } satisfies LoginError;
      }
      if (typeof messageRaw === 'string') {
        throw { status, code, message: messageRaw, traceId } satisfies LoginError;
      }
      if (detail) throw { status, code, message: detail, traceId } satisfies LoginError;
    }

    // Generic string message (401, 403, 500)
    if (typeof messageRaw === 'string' && messageRaw.length > 0) {
      // Trust contract messages: they are already Vietnamese as per spec
      // e.g., "Thông tin đăng nhập không hợp lệ", "Tài khoản đã ngừng hoạt động", etc.
      throw { status, code, message: messageRaw, traceId } satisfies LoginError;
    }
    if (typeof errorRaw === 'string' && errorRaw.length > 0 && status >= 400) {
      throw { status, code, message: errorRaw, traceId } satisfies LoginError;
    }
    if (detail) throw { status, code, message: detail, traceId } satisfies LoginError;
  }

  if (typeof body === 'string' && body.length > 0) {
    throw { status, message: body } satisfies LoginError;
  }

  throw { status, message: fallback[status] ?? `Yêu cầu thất bại (${status})` } satisfies LoginError;
}
