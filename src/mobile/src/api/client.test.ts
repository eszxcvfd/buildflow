import { loginRequest, logoutRequest, LoginError } from './client';

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
