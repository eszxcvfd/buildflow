import { listProjects, getProject, LoginError } from './client';

const projectBody = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'PRJ-001',
  name: 'Dự án 1',
  status: 'ACTIVE',
  managerId: '22222222-2222-4222-8222-222222222222',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
};

describe('projects client (PRJ-SRS-006, issue #37)', () => {
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

  it('listProjects 200: GETs /api/v1/projects with Bearer token + limit/offset and maps the bare array', async () => {
    const mock = jest.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
      expect(url).toContain('/api/v1/projects?limit=20&offset=0');
      expect(init?.headers?.Authorization).toBe('Bearer tok-1');
      return jsonResponse([projectBody], 200);
    });
    // eslint-disable-next-line no-native-reassign
    global.fetch = mock as unknown as typeof fetch;

    const out = await listProjects('tok-1', { limit: 20, offset: 0 });
    expect(out).toHaveLength(1);
    expect(out[0].code).toBe('PRJ-001');
    expect(out[0].status).toBe('ACTIVE');
  });

  it('listProjects 200: tolerates a paginated envelope ({ data })', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () =>
      jsonResponse({ data: [projectBody], total: 1, limit: 20, offset: 0 }, 200),
    ) as unknown as typeof fetch;

    const out = await listProjects('tok-1');
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(projectBody.id);
  });

  it('listProjects 401: keeps the 401 kind so screens can link back to login', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () =>
      jsonResponse({ message: 'Unauthorized', statusCode: 401 }, 401),
    ) as unknown as typeof fetch;

    await expect(listProjects('tok-1')).rejects.toMatchObject({
      name: 'LoginError',
      status: 401,
    });
  });

  it('listProjects 401 without server message: falls back to the expired-session copy', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () => jsonResponse({}, 401)) as unknown as typeof fetch;

    await expect(listProjects('tok-1')).rejects.toMatchObject({
      name: 'LoginError',
      status: 401,
      message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
    });
  });

  it('getProject 200: GETs /api/v1/projects/:id with the Bearer token and maps the payload', async () => {
    const mock = jest.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
      expect(url).toContain(`/api/v1/projects/${projectBody.id}`);
      expect(init?.headers?.Authorization).toBe('Bearer tok-1');
      return jsonResponse(projectBody, 200);
    });
    // eslint-disable-next-line no-native-reassign
    global.fetch = mock as unknown as typeof fetch;

    const out = await getProject('tok-1', projectBody.id);
    expect(out.code).toBe('PRJ-001');
    expect(out.name).toBe('Dự án 1');
    expect(out.managerId).toBe(projectBody.managerId);
  });

  it('getProject 403: maps the not-a-member message (anti-leak denial)', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () =>
      jsonResponse({ message: 'Không có quyền truy cập dự án này', statusCode: 403 }, 403),
    ) as unknown as typeof fetch;

    const err: LoginError = await getProject('tok-1', projectBody.id).then(
      () => { throw new Error('should have thrown'); },
      (e) => e,
    );
    expect(err).toBeInstanceOf(LoginError);
    expect(err.status).toBe(403);
    expect(err.message).toBe('Không có quyền truy cập dự án này');
  });

  it('getProject 404: maps the not-found message', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () =>
      jsonResponse({ message: 'Không tìm thấy dự án', statusCode: 404 }, 404),
    ) as unknown as typeof fetch;

    await expect(getProject('tok-1', projectBody.id)).rejects.toMatchObject({
      name: 'LoginError',
      status: 404,
      message: 'Không tìm thấy dự án',
    });
  });

  it('getProject 401: keeps the 401 kind so screens can link back to login', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () =>
      jsonResponse({ message: 'Unauthorized', statusCode: 401 }, 401),
    ) as unknown as typeof fetch;

    await expect(getProject('tok-1', projectBody.id)).rejects.toMatchObject({
      name: 'LoginError',
      status: 401,
    });
  });
});
