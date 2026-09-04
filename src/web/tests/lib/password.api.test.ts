/**
 * Unit tests cho password API client (IAM-SRS-007, GitHub issue #22).
 * Contract đã chốt:
 * - PATCH /api/v1/me/password: body { currentPassword, newPassword, confirmPassword } (confirmPassword gửi riêng).
 * - POST /api/v1/auth/password-reset/confirm: body { token, newPassword, confirmPassword }.
 * - POST /api/v1/auth/password-reset/request: LUÔN { message } generic — client không phụ thuộc resetUrl.
 * - 400 Nest: message là MẢNG chuỗi; lỗi use-case: { message, errors: { field: msg } }; 401 → Error có status=401.
 */
import { changePassword, confirmPasswordReset, requestPasswordReset, extractFieldErrors } from '@/lib/api/password';

function mockJsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

function setFetch(fn: jest.Mock) {
  (global as unknown as { fetch: unknown }).fetch = fn;
}

function getFetchMock(): jest.Mock {
  return (global as unknown as { fetch: jest.Mock }).fetch;
}

function makeError(status: number, message: string, fieldErrors?: Record<string, string[]>) {
  const e = new Error(message) as Error & { status: number; fieldErrors?: Record<string, string[]> };
  e.status = status;
  if (fieldErrors) e.fieldErrors = fieldErrors;
  return e;
}

describe('extractFieldErrors', () => {
  it('maps Nest array message by keyword to the right field', () => {
    const fe = extractFieldErrors({
      message: ['Mật khẩu hiện tại không đúng', 'Xác nhận mật khẩu không khớp', 'Mật khẩu mới tối thiểu 8 ký tự', 'Token không hợp lệ hoặc đã hết hạn', 'Yêu cầu không hợp lệ'],
    });
    expect(fe).toEqual({
      currentPassword: ['Mật khẩu hiện tại không đúng'],
      confirmPassword: ['Xác nhận mật khẩu không khớp'],
      newPassword: ['Mật khẩu mới tối thiểu 8 ký tự'],
      token: ['Token không hợp lệ hoặc đã hết hạn'],
      _global: ['Yêu cầu không hợp lệ'],
    });
  });
  it('maps use-case errors object { field: msg } by field key', () => {
    const fe = extractFieldErrors({ message: 'Dữ liệu không hợp lệ', errors: { currentPassword: 'Sai mật khẩu hiện tại', newPassword: ['Quy tắc mật khẩu chưa đạt'] } });
    expect(fe).toMatchObject({ currentPassword: ['Sai mật khẩu hiện tại'], newPassword: ['Quy tắc mật khẩu chưa đạt'] });
  });
  it('returns undefined for non-object or empty input', () => {
    expect(extractFieldErrors(null)).toBeUndefined();
    expect(extractFieldErrors('oops')).toBeUndefined();
    expect(extractFieldErrors({})).toBeUndefined();
  });
});

describe('PATCH /api/v1/me/password (changePassword)', () => {
  const baseEnv = process.env.NEXT_PUBLIC_API_URL;
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
    jest.restoreAllMocks();
  });
  afterAll(() => {
    if (baseEnv) process.env.NEXT_PUBLIC_API_URL = baseEnv;
    else delete process.env.NEXT_PUBLIC_API_URL;
  });

  it('success: sends confirmPassword as a separate field + Bearer token', async () => {
    setFetch(jest.fn().mockResolvedValueOnce(mockJsonResponse(200, { message: 'Đổi mật khẩu thành công', reauthRequired: true })));
    const out = await changePassword('tok123', 'OldPass1', 'NewPass1', 'NewPass1');
    expect(out).toEqual({ message: 'Đổi mật khẩu thành công', reauthRequired: true });
    expect(getFetchMock()).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/me/password',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ Authorization: 'Bearer tok123', 'Content-Type': 'application/json; charset=utf-8' }),
        body: JSON.stringify({ currentPassword: 'OldPass1', newPassword: 'NewPass1', confirmPassword: 'NewPass1' }),
      }),
    );
  });

  it('400 Nest array message → fieldErrors mapped per field (currentPassword sai vẫn là 400)', async () => {
    setFetch(jest.fn().mockResolvedValueOnce(mockJsonResponse(400, {
      message: ['Mật khẩu hiện tại không đúng', 'Xác nhận mật khẩu không khớp'],
      error: 'Bad Request',
      statusCode: 400,
    })));
    await expect(changePassword('tok123', 'wrong', 'NewPass1', 'NewPass1')).rejects.toMatchObject({
      status: 400,
      fieldErrors: {
        currentPassword: ['Mật khẩu hiện tại không đúng'],
        confirmPassword: ['Xác nhận mật khẩu không khớp'],
      },
    });
  });

  it('400 use-case { message, errors } → fieldErrors theo field key', async () => {
    setFetch(jest.fn().mockResolvedValueOnce(mockJsonResponse(400, {
      message: 'Dữ liệu không hợp lệ',
      errors: { currentPassword: 'Mật khẩu hiện tại không đúng' },
    })));
    await expect(changePassword('tok123', 'wrong', 'NewPass1', 'NewPass1')).rejects.toMatchObject({
      status: 400,
      message: 'Dữ liệu không hợp lệ',
      fieldErrors: { currentPassword: ['Mật khẩu hiện tại không đúng'] },
    });
  });

  it('401 → real Error with status=401 (session chết), không fieldErrors', async () => {
    setFetch(jest.fn().mockResolvedValueOnce(mockJsonResponse(401, { message: 'Phiên hết hạn, vui lòng đăng nhập lại', statusCode: 401 })));
    const err = await changePassword('tok123', 'a', 'b', 'b').then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).toMatchObject({ status: 401, message: 'Phiên hết hạn, vui lòng đăng nhập lại' });
    expect((err as { fieldErrors?: unknown }).fieldErrors).toBeUndefined();
  });

  it('network failure → PasswordActionError với fallback message (không phải TypeError thô)', async () => {
    setFetch(jest.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')));
    await expect(changePassword('tok123', 'a', 'b', 'b')).rejects.toMatchObject({ status: 0, message: 'Đổi mật khẩu thất bại' });
  });
});

describe('POST /api/v1/auth/password-reset/confirm (confirmPasswordReset)', () => {
  const baseEnv = process.env.NEXT_PUBLIC_API_URL;
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
    jest.restoreAllMocks();
  });
  afterAll(() => {
    if (baseEnv) process.env.NEXT_PUBLIC_API_URL = baseEnv;
    else delete process.env.NEXT_PUBLIC_API_URL;
  });

  it('sends token + newPassword + confirmPassword (confirm bắt buộc)', async () => {
    setFetch(jest.fn().mockResolvedValueOnce(mockJsonResponse(200, { message: 'OK', reauthRequired: true })));
    await confirmPasswordReset('reset-tok', 'NewPass1', 'NewPass1');
    expect(getFetchMock()).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/auth/password-reset/confirm',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'reset-tok', newPassword: 'NewPass1', confirmPassword: 'NewPass1' }),
      }),
    );
  });

  it('token invalid/used/expired → 401 Error có status=401 + message từ body', async () => {
    setFetch(jest.fn().mockResolvedValueOnce(mockJsonResponse(401, { message: 'Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn', statusCode: 401 })));
    await expect(confirmPasswordReset('bad-tok', 'NewPass1', 'NewPass1')).rejects.toMatchObject({
      status: 401,
      message: 'Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
    });
  });

  it('400 → fieldErrors.confirmPassword render được từ fieldErrors', async () => {
    setFetch(jest.fn().mockResolvedValueOnce(mockJsonResponse(400, {
      message: ['Xác nhận mật khẩu không khớp'],
      statusCode: 400,
    })));
    await expect(confirmPasswordReset('reset-tok', 'NewPass1', 'Other1')).rejects.toMatchObject({
      status: 400,
      fieldErrors: { confirmPassword: ['Xác nhận mật khẩu không khớp'] },
    });
  });
});

describe('POST /api/v1/auth/password-reset/request (requestPasswordReset) — anti-enumeration', () => {
  const baseEnv = process.env.NEXT_PUBLIC_API_URL;
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
    jest.restoreAllMocks();
  });
  afterAll(() => {
    if (baseEnv) process.env.NEXT_PUBLIC_API_URL = baseEnv;
    else delete process.env.NEXT_PUBLIC_API_URL;
  });

  it('success: resolves generic { message }, không gửi Authorization', async () => {
    setFetch(jest.fn().mockResolvedValueOnce(mockJsonResponse(201, { message: 'Nếu email tồn tại, hướng dẫn đã được gửi' })));
    const out = await requestPasswordReset('a@b.com');
    expect(out).toEqual({ message: 'Nếu email tồn tại, hướng dẫn đã được gửi' });
    const [, init] = getFetchMock().mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.com' });
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('KHÔNG phụ thuộc resetUrl: response dính key resetUrl (phòng hờ) cũng bị bỏ qua', async () => {
    setFetch(jest.fn().mockResolvedValueOnce(mockJsonResponse(200, {
      message: 'OK',
      resetUrl: 'http://localhost:3000/reset-password?token=leaked',
      devResetUrl: 'http://localhost:3000/reset-password?token=leaked',
    })));
    const out = await requestPasswordReset('a@b.com');
    expect(out).toEqual({ message: 'OK' });
    expect(out).not.toHaveProperty('resetUrl');
    expect(out).not.toHaveProperty('devResetUrl');
    expect(JSON.stringify(out)).not.toContain('leaked');
  });

  it('400 → fieldErrors từ mảng message (fallback _global cho msg không nhận dạng được)', async () => {
    setFetch(jest.fn().mockResolvedValueOnce(mockJsonResponse(400, {
      message: ['email must be an email'],
      statusCode: 400,
    })));
    await expect(requestPasswordReset('not-an-email')).rejects.toMatchObject({
      status: 400,
      fieldErrors: { _global: ['email must be an email'] },
    });
  });

  it('lỗi mạng → fallback message', async () => {
    setFetch(jest.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')));
    await expect(requestPasswordReset('a@b.com')).rejects.toMatchObject({ status: 0, message: 'Gửi yêu cầu thất bại' });
  });
});
