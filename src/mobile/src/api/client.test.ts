import { loginRequest, logoutRequest, changePasswordRequest, requestPasswordResetRequest, confirmPasswordResetRequest, LoginError } from './client';

const successBody = {
  accessToken: 'token-123',
  expiresAt: '2026-01-01T00:00:00.000Z',
  user: { id: 'u1', email: 'e2e@example.com', fullName: 'E2E User', status: 'ACTIVE', userType: 'STAFF' },
  roles: [{ id: 'r1', code: 'WORKER', name: 'Worker' }],
  projectIds: [],
};

describe('loginRequest', () => {
  const jsonResponse = (body: unknown, status: number) => ({
    ok: status < 400,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  });

  afterEach(() => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = globalThis.fetch;
  });

  it('200: maps success payload and posts JSON with UTF-8 header', async () => {
    const mockFetch = jest.fn(async (url: string, init?: { method?: string; headers?: Record<string, string> }) => {
      expect(url).toContain('/api/v1/auth/login');
      expect(init?.method).toBe('POST');
      expect(String(init?.headers?.['Content-Type'])).toContain('application/json');
      return jsonResponse(successBody, 200);
    });
    // eslint-disable-next-line no-native-reassign
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await loginRequest('e2e@example.com ', 'Password123!');
    expect(result.accessToken).toBe('token-123');
    expect(result.user.fullName).toBe('E2E User');
    expect(result.roles[0].code).toBe('WORKER');
  });

  it('401: maps generic invalid-credential message without revealing account existence', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () =>
      jsonResponse({ message: 'Thông tin đăng nhập không hợp lệ', statusCode: 401 }, 401),
    ) as unknown as typeof fetch;

    await expect(loginRequest('nobody@example.com', 'wrong')).rejects.toMatchObject({
      name: 'LoginError',
      status: 401,
      message: 'Thông tin đăng nhập không hợp lệ',
    });
  });

  it('403: maps locked-account message', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () =>
      jsonResponse({ message: 'Tài khoản đang bị khóa', statusCode: 403 }, 403),
    ) as unknown as typeof fetch;

    await expect(loginRequest('e2e@example.com', 'Password123!')).rejects.toBeInstanceOf(LoginError);
  });
});

describe('logoutRequest', () => {
  const jsonResponse = (status: number) => ({
    ok: status < 400,
    status,
    headers: { get: () => 'application/json' },
    json: async () => ({}),
    text: async () => '{}',
  });

  afterEach(() => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = globalThis.fetch;
  });

  it('sends Bearer token and accepts 200', async () => {
    const mock = jest.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
      expect(url).toContain('/api/v1/auth/logout');
      expect(init?.headers?.Authorization).toBe('Bearer tok-1');
      return jsonResponse(200);
    });
    // eslint-disable-next-line no-native-reassign
    global.fetch = mock as unknown as typeof fetch;
    await expect(logoutRequest('tok-1')).resolves.toBeUndefined();
  });

  it('treats 401 (already expired/revoked) as success (idempotent)', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () => jsonResponse(401)) as unknown as typeof fetch;
    await expect(logoutRequest('tok-1')).resolves.toBeUndefined();
  });

  it('throws on unexpected server error (e.g. 500) so UI can retry', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () => jsonResponse(500)) as unknown as typeof fetch;
    await expect(logoutRequest('tok-1')).rejects.toThrow('Đăng xuất thất bại (500)');
  });
});

describe('password actions (IAM-SRS-007, issue #22)', () => {
  const jsonResponse = (body: unknown, status: number) => ({
    ok: status < 400,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  });

  afterEach(() => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = globalThis.fetch;
  });

  it('changePasswordRequest 200: sends confirmPassword in the PATCH body and maps the payload', async () => {
    const mock = jest.fn(async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
      expect(url).toContain('/api/v1/me/password');
      expect(init?.method).toBe('PATCH');
      expect(init?.headers?.Authorization).toBe('Bearer tok-1');
      expect(JSON.parse(String(init?.body))).toEqual({
        currentPassword: 'OldPass123',
        newPassword: 'NewPass123',
        confirmPassword: 'NewPass123',
      });
      return jsonResponse({ message: 'Đổi mật khẩu thành công', reauthRequired: true }, 200);
    });
    // eslint-disable-next-line no-native-reassign
    global.fetch = mock as unknown as typeof fetch;

    const out = await changePasswordRequest('tok-1', 'OldPass123', 'NewPass123', 'NewPass123');
    expect(out).toEqual({ message: 'Đổi mật khẩu thành công', reauthRequired: true });
  });

  it('changePasswordRequest 400 use-case: { message, errors } maps into fieldErrors', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () =>
      jsonResponse({ message: 'Đổi mật khẩu thất bại', errors: { currentPassword: 'Mật khẩu hiện tại không đúng' } }, 400),
    ) as unknown as typeof fetch;

    const err: LoginError = await changePasswordRequest('tok-1', 'wrong', 'NewPass123', 'NewPass123').then(
      () => { throw new Error('should have thrown'); },
      (e) => e,
    );
    expect(err).toBeInstanceOf(LoginError);
    expect(err.status).toBe(400);
    expect(err.message).toBe('Đổi mật khẩu thất bại');
    expect(err.fieldErrors).toEqual({ currentPassword: ['Mật khẩu hiện tại không đúng'] });
  });

  it('changePasswordRequest 400 Nest: message array is classified into fields', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () =>
      jsonResponse(
        { message: ['Mật khẩu hiện tại không đúng', 'Mật khẩu mới tối thiểu 8 ký tự'], error: 'Bad Request', statusCode: 400 },
        400,
      ),
    ) as unknown as typeof fetch;

    const err: LoginError = await changePasswordRequest('tok-1', 'wrong', 'short', 'short').then(
      () => { throw new Error('should have thrown'); },
      (e) => e,
    );
    expect(err.status).toBe(400);
    expect(err.fieldErrors).toEqual({
      currentPassword: ['Mật khẩu hiện tại không đúng'],
      newPassword: ['Mật khẩu mới tối thiểu 8 ký tự'],
    });
  });

  it('changePasswordRequest 401: maps the server message with no fieldErrors (dead session)', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () =>
      jsonResponse({ message: 'Phiên đăng nhập đã hết hạn', statusCode: 401 }, 401),
    ) as unknown as typeof fetch;

    const err: LoginError = await changePasswordRequest('tok-1', 'a', 'b', 'b').then(
      () => { throw new Error('should have thrown'); },
      (e) => e,
    );
    expect(err.status).toBe(401);
    expect(err.message).toBe('Phiên đăng nhập đã hết hạn');
    expect(err.fieldErrors).toBeUndefined();
  });

  it('changePasswordRequest non-JSON 500: falls back to the status message', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      headers: { get: () => 'text/html' },
      json: async () => { throw new Error('not json'); },
      text: async () => '<html>boom</html>',
    })) as unknown as typeof fetch;

    await expect(changePasswordRequest('tok-1', 'a', 'b', 'b')).rejects.toMatchObject({
      name: 'LoginError',
      status: 500,
      message: 'Đổi mật khẩu thất bại (500)',
    });
  });

  it('changePasswordRequest network failure: maps to a stable fallback LoginError', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () => { throw new TypeError('Network request failed'); }) as unknown as typeof fetch;

    await expect(changePasswordRequest('tok-1', 'a', 'b', 'b')).rejects.toMatchObject({
      name: 'LoginError',
      status: 0,
      message: 'Không thể kết nối máy chủ, vui lòng thử lại',
    });
  });

  it('confirmPasswordResetRequest: sends confirmPassword in the body and maps use-case fieldErrors', async () => {
    const mock = jest.fn(async (url: string, init?: { method?: string; body?: string }) => {
      expect(url).toContain('/api/v1/auth/password-reset/confirm');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({
        token: 'tok-1',
        newPassword: 'NewPass123',
        confirmPassword: 'NewPass123',
      });
      return jsonResponse({ message: 'Đặt lại mật khẩu thất bại', errors: { token: 'Token không hợp lệ hoặc đã hết hạn' } }, 400);
    });
    // eslint-disable-next-line no-native-reassign
    global.fetch = mock as unknown as typeof fetch;

    const err: LoginError = await confirmPasswordResetRequest('tok-1', 'NewPass123', 'NewPass123').then(
      () => { throw new Error('should have thrown'); },
      (e) => e,
    );
    expect(err.status).toBe(400);
    expect(err.message).toBe('Đặt lại mật khẩu thất bại');
    expect(err.fieldErrors).toEqual({ token: ['Token không hợp lệ hoặc đã hết hạn'] });
  });

  it('requestPasswordResetRequest: resolves with the generic message only (no resetUrl in contract)', async () => {
    const mock = jest.fn(async (url: string, init?: { method?: string; body?: string }) => {
      expect(url).toContain('/api/v1/auth/password-reset/request');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({ email: 'e2e@example.com' });
      return jsonResponse({ message: 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.' }, 200);
    });
    // eslint-disable-next-line no-native-reassign
    global.fetch = mock as unknown as typeof fetch;

    const out = await requestPasswordResetRequest('e2e@example.com');
    expect(out).toEqual({ message: 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.' });
    expect('resetUrl' in out).toBe(false);
  });

  it('requestPasswordResetRequest error: maps status through LoginError (UI keeps generic copy)', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () =>
      jsonResponse({ message: ['email must be an email'], error: 'Bad Request', statusCode: 400 }, 400),
    ) as unknown as typeof fetch;

    const err: LoginError = await requestPasswordResetRequest('not-an-email').then(
      () => { throw new Error('should have thrown'); },
      (e) => e,
    );
    expect(err.status).toBe(400);
    expect(err.fieldErrors).toEqual({ _global: ['email must be an email'] });
  });
});
