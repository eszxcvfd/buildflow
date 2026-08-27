/**
 * Route smoke test cho đăng xuất IAM-SRS-002
 * Contract: POST /api/v1/auth/logout với Authorization: Bearer <token>
 * 200 và 401 đều clearAuth + redirect /login (idempotent)
 */
import { logoutRequest } from '@/lib/api/auth';
import { logoutAndClear } from '@/features/auth/services/auth.service';
import { saveAuth, getAuth, clearAuth } from '@/lib/auth/storage';
import type { StoredAuth } from '@/lib/auth/storage';

function mockJsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

function makeAuth(token = 'jwt.token.here'): StoredAuth {
  return {
    accessToken: token,
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    user: { id: 'u1', email: 'a@b.com', fullName: 'A B', status: 'ACTIVE', userType: 'STAFF' },
    roles: [{ id: 'r1', code: 'WORKER', name: 'Worker' }],
    projectIds: ['p1'],
  };
}

describe('POST /api/v1/auth/logout contract', () => {
  const origInternal = process.env.API_INTERNAL_URL;
  const origPublic = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });
  afterEach(() => {
    if (origInternal === undefined) delete process.env.API_INTERNAL_URL;
    else process.env.API_INTERNAL_URL = origInternal;
    if (origPublic === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = origPublic;
  });

  it('logout 200: gọi đúng contract với Bearer token và xóa storage sau đó', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://public:3000';
    process.env.API_INTERNAL_URL = 'http://internal:3000';
    // window exists => must use public
    const fetchMock = jest.fn().mockResolvedValueOnce(mockJsonResponse(200, { message: 'Đã đăng xuất' }));
    (global as unknown as { fetch: unknown }).fetch = fetchMock;

    saveAuth(makeAuth('tok123'));
    expect(getAuth()?.accessToken).toBe('tok123');

    await logoutAndClear();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://public:3000/api/v1/auth/logout',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok123' }),
      }),
    );
    expect(getAuth()).toBeNull();
  });

  it('logout 401 "Phiên hết hạn" vẫn clearAuth idempotent', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://public:3000';
    const fetchMock = jest.fn().mockResolvedValueOnce(
      mockJsonResponse(401, { message: 'Phiên hết hạn, vui lòng đăng nhập lại', statusCode: 401 }),
    );
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
    saveAuth(makeAuth('expiredTok'));
    await logoutAndClear();
    // dù 401 vẫn xóa local
    expect(getAuth()).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/auth/logout'), expect.any(Object));
  });

  it('logout khi không có token vẫn clearAuth (không gọi fetch nếu token rỗng)', async () => {
    localStorage.clear();
    expect(getAuth()).toBeNull();
    const fetchMock = jest.fn();
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
    await logoutAndClear();
    // không có token => không gọi logoutRequest, chỉ clear
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getAuth()).toBeNull();
  });

  it('logoutRequest browser boundary: không dùng API_INTERNAL_URL', async () => {
    expect(typeof window).not.toBe('undefined');
    process.env.API_INTERNAL_URL = 'http://internal:3000';
    process.env.NEXT_PUBLIC_API_URL = 'http://public:3000';
    const fetchMock = jest.fn().mockResolvedValueOnce(mockJsonResponse(200, {}));
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
    await logoutRequest('tok');
    expect(fetchMock).toHaveBeenCalledWith('http://public:3000/api/v1/auth/logout', expect.any(Object));
  });

  it('dashboard handleLogout integration: sau logout không còn token để request bảo vệ', async () => {
    // Mô phỏng flow: login -> logout -> getAuth null
    saveAuth(makeAuth('tok'));
    const fetchMock = jest.fn().mockResolvedValueOnce(mockJsonResponse(200, {}));
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
    await logoutAndClear();
    expect(getAuth()).toBeNull();
    // clearAuth đã gọi, token cũ không còn dùng cho request bảo vệ
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('route smoke logout', () => {
  it('dashboard page uses logoutAndClear (không tự xử lý thu hồi)', async () => {
    const fs = await import('fs');
    const dash = fs.readFileSync('src/app/(app)/dashboard/page.tsx', 'utf8');
    expect(dash).toMatch(/logoutAndClear/);
    expect(dash).not.toMatch(/fetch.*\/api\/v1\/auth\/logout/); // business logic ở features, app chỉ composition
    const service = fs.readFileSync('src/features/auth/services/auth.service.ts', 'utf8');
    expect(service).toMatch(/logoutRequest/);
    expect(service).toMatch(/clearAuth/);
    // ensure contract POST /api/v1/auth/logout with Bearer
    const authLib = fs.readFileSync('src/lib/api/auth.ts', 'utf8');
    expect(authLib).toMatch(/\/api\/v1\/auth\/logout/);
    expect(authLib).toMatch(/Authorization/);
    expect(authLib).toMatch(/Bearer/);
  });
});
