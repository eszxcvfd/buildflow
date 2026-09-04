/**
 * Route smoke test cho luồng login (IAM-SRS-001)
 * - success + 1 error flow
 * - contract POST /api/v1/auth/login JSON UTF-8
 * - xử lý nhãn lỗi 400/401/403 + token expired
 * - storage + BR-13 filtering hint
 */
import { validateLogin } from '@/features/auth/schemas/login.schema';
import { saveAuth, getAuth, clearAuth, isTokenExpired } from '@/lib/auth/storage';
import { loginRequest } from '@/lib/api/auth';
import { loginAndPersist } from '@/features/auth/services/auth.service';
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

describe('validateLogin', () => {
  it('rejects empty email/password', () => {
    const r = validateLogin({ email: '', password: '' });
    expect(r.valid).toBe(false);
    expect(r.fieldErrors.email).toBeDefined();
    expect(r.fieldErrors.password).toBeDefined();
  });
  it('rejects invalid email', () => {
    const r = validateLogin({ email: 'not-an-email', password: 'secret123' });
    expect(r.valid).toBe(false);
    expect(r.fieldErrors.email?.[0]).toMatch(/Email không hợp lệ/);
  });
  it('accepts valid payload', () => {
    const r = validateLogin({ email: 'a@b.com', password: 'secret123' });
    expect(r.valid).toBe(true);
  });
});

describe('auth storage (WEB.md interim localStorage)', () => {
  beforeEach(() => localStorage.clear());
  it('save/get/clear roundtrip', () => {
    const auth: StoredAuth = {
      accessToken: 'tok',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      user: { id: 'u1', email: 'a@b.com', fullName: 'A B', status: 'ACTIVE', userType: 'STAFF' },
      roles: [{ id: 'r1', code: 'WORKER', name: 'Worker' }],
      projectIds: ['p1', 'p2'],
    };
    saveAuth(auth);
    expect(getAuth()).toEqual(auth);
    clearAuth();
    expect(getAuth()).toBeNull();
  });
  it('detects expired token (Phiên hết hạn)', () => {
    const expired: StoredAuth = {
      accessToken: 'tok',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      user: { id: 'u1', email: 'a@b.com', fullName: 'A', status: 'ACTIVE', userType: 'STAFF' },
      roles: [],
      projectIds: [],
    };
    expect(isTokenExpired(expired)).toBe(true);
  });
});

describe('POST /api/v1/auth/login contract', () => {
  const baseEnv = process.env.NEXT_PUBLIC_API_URL;
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });
  afterAll(() => {
    if (baseEnv) process.env.NEXT_PUBLIC_API_URL = baseEnv;
    else delete process.env.NEXT_PUBLIC_API_URL;
  });

  it('login success: persists accessToken/expiresAt + roles/projectIds (BR-13)', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
    const payload = {
      accessToken: 'jwt.token.here',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      user: { id: 'u1', email: 'a@b.com', fullName: 'A B', status: 'ACTIVE', userType: 'STAFF' },
      roles: [{ id: 'r1', code: 'WORKER', name: 'Worker' }],
      projectIds: ['p1'],
    };
    (global as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValueOnce(mockJsonResponse(200, payload));
    const result = await loginRequest({ email: 'a@b.com', password: 'secret123' });
    expect(result.accessToken).toBe(payload.accessToken);
    expect(result.roles).toEqual(payload.roles);
    expect(result.projectIds).toEqual(payload.projectIds);
    expect((global as unknown as { fetch: jest.Mock }).fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json; charset=utf-8' }),
        body: JSON.stringify({ email: 'a@b.com', password: 'secret123' }),
      }),
    );
    // service layer persists
    (global as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValueOnce(mockJsonResponse(200, payload));
    const saved = await loginAndPersist('a@b.com', 'secret123');
    expect(getAuth()?.accessToken).toBe(saved.accessToken);
  });

  it('error flow: 401 generic "Thông tin đăng nhập không hợp lệ" (không lộ tồn tại)', async () => {
    (global as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValueOnce(
      mockJsonResponse(401, { message: 'Thông tin đăng nhập không hợp lệ', statusCode: 401 }),
    );
    await expect(loginRequest({ email: 'x@b.com', password: 'wrong' })).rejects.toMatchObject({
      status: 401,
      message: 'Thông tin đăng nhập không hợp lệ',
    });
  });

  it('error flow: 403 "Tài khoản đã ngừng hoạt động"', async () => {
    (global as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValueOnce(
      mockJsonResponse(403, { message: 'Tài khoản đã ngừng hoạt động', statusCode: 403 }),
    );
    await expect(loginRequest({ email: 'a@b.com', password: 'secret123' })).rejects.toMatchObject({
      status: 403,
      message: 'Tài khoản đã ngừng hoạt động',
    });
  });

  it('error flow: 403 "Tài khoản đang bị khóa"', async () => {
    (global as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValueOnce(
      mockJsonResponse(403, { message: 'Tài khoản đang bị khóa', statusCode: 403 }),
    );
    await expect(loginRequest({ email: 'a@b.com', password: 'secret123' })).rejects.toMatchObject({
      status: 403,
      message: 'Tài khoản đang bị khóa',
    });
  });

  it('error flow: 401 "Phiên hết hạn, vui lòng đăng nhập lại"', async () => {
    (global as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValueOnce(
      mockJsonResponse(401, { message: 'Phiên hết hạn, vui lòng đăng nhập lại', statusCode: 401 }),
    );
    await expect(loginRequest({ email: 'a@b.com', password: 'secret123' })).rejects.toMatchObject({
      status: 401,
      message: 'Phiên hết hạn, vui lòng đăng nhập lại',
    });
  });

  it('error flow: 400 validation returns fieldErrors', async () => {
    (global as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValueOnce(
      mockJsonResponse(400, { message: ['Email không hợp lệ', 'password should not be empty'], error: 'Bad Request', statusCode: 400 }),
    );
    await expect(loginRequest({ email: 'bad', password: '' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: expect.objectContaining({ email: expect.any(Array) }),
    });
  });
});

describe('getApiBaseUrl server/client boundary (WEB.md) – regression for API_INTERNAL_URL', () => {
  const origInternal = process.env.API_INTERNAL_URL;
  const origPublic = process.env.NEXT_PUBLIC_API_URL;
  afterEach(() => {
    if (origInternal === undefined) delete process.env.API_INTERNAL_URL;
    else process.env.API_INTERNAL_URL = origInternal;
    if (origPublic === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = origPublic;
    jest.restoreAllMocks();
  });

  it('browser (window exists) must NOT use API_INTERNAL_URL even when both envs set', async () => {
    expect(typeof window).not.toBe('undefined'); // jsdom guarantees window
    process.env.API_INTERNAL_URL = 'http://internal:3000';
    process.env.NEXT_PUBLIC_API_URL = 'http://public:3000';
    const payload = {
      accessToken: 'tok',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      user: { id: 'u1', email: 'a@b.com', fullName: 'A', status: 'ACTIVE', userType: 'STAFF' },
      roles: [],
      projectIds: [],
    };
    const fetchMock = jest.fn().mockResolvedValueOnce(mockJsonResponse(200, payload));
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
    await loginRequest({ email: 'a@b.com', password: 'x' });
    expect(fetchMock).toHaveBeenCalledWith('http://public:3000/api/v1/auth/login', expect.any(Object));
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('internal'), expect.any(Object));
  });

  it('browser fallback to localhost when NEXT_PUBLIC_API_URL missing (ignores internal)', async () => {
    expect(typeof window).not.toBe('undefined');
    process.env.API_INTERNAL_URL = 'http://internal:3000';
    delete process.env.NEXT_PUBLIC_API_URL;
    const payload = {
      accessToken: 'tok',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      user: { id: 'u1', email: 'a@b.com', fullName: 'A', status: 'ACTIVE', userType: 'STAFF' },
      roles: [],
      projectIds: [],
    };
    const fetchMock = jest.fn().mockResolvedValueOnce(mockJsonResponse(200, payload));
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
    await loginRequest({ email: 'a@b.com', password: 'x' });
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/api/v1/auth/login', expect.any(Object));
  });
});

describe('route smoke', () => {
  it('login page and dashboard route exist', async () => {
    const fs = await import('fs');
    expect(fs.existsSync('src/app/(auth)/login/page.tsx')).toBe(true);
    expect(fs.existsSync('src/app/(app)/dashboard/page.tsx')).toBe(true);
    const loginPage = fs.readFileSync('src/app/(auth)/login/page.tsx', 'utf8');
    expect(loginPage).toMatch(/LoginForm/);
    const dash = fs.readFileSync('src/app/(app)/dashboard/page.tsx', 'utf8');
    // Dashboard redesign: page không còn thẻ minh họa BR-13 — chỉ đọc getAuth()
    // để chào theo tên; phạm vi dữ liệu (project-scoped, IAM-SRS-006/BR-13) do server lọc.
    expect(dash).toMatch(/getAuth/);
    expect(dash).toMatch(/PageHeader/);
  });
  it('does not import src/api (boundary WORK-ROUTING.md)', async () => {
    const fs = await import('fs');
    // Lightweight check: ensure no web source imports from src/api
    const text = fs.readFileSync('src/lib/api/auth.ts', 'utf8') + fs.readFileSync('src/features/auth/services/auth.service.ts', 'utf8');
    expect(text).not.toMatch(/from ['"]src\/api/);
    expect(text).not.toMatch(/from ['"]\.\.\/\.\.\/\.\.\/api/);
  });
});
