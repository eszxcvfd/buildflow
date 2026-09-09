import { fetchJobBoard, fetchWorkOrderPreview, LoginError } from './client';

const itemBody = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'WO-001',
  title: 'Thi công dầm sàn',
  projectId: '22222222-2222-4222-8222-222222222222',
  projectName: 'Dự án A',
  areaId: null,
  areaName: null,
  workTypeId: '33333333-3333-4333-8333-333333333333',
  workTypeName: 'Bê tông',
  requiredTradeId: null,
  requiredTradeName: null,
  priority: 'HIGH',
  plannedStartAt: null,
  plannedEndAt: null,
  plannedHeadcount: 5,
  version: 1,
  jobBoard: { open: true, openFrom: null, openUntil: null, state: 'AVAILABLE' },
};

describe('job board client (JOB-SRS-005, issue #45)', () => {
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

  it('fetchJobBoard 200: GETs /api/v1/job-board with Bearer token + limit/offset and maps the envelope', async () => {
    const mock = jest.fn(async (url: string, init?: { headers?: Record<string, string>; cache?: string }) => {
      expect(url).toContain('/api/v1/job-board?limit=20&offset=0');
      expect(init?.headers?.Authorization).toBe('Bearer tok-1');
      expect(init?.cache).toBe('no-store');
      return jsonResponse({ data: [itemBody], total: 1, limit: 20, offset: 0 }, 200);
    });
    // eslint-disable-next-line no-native-reassign
    global.fetch = mock as unknown as typeof fetch;

    const out = await fetchJobBoard('tok-1', { limit: 20, offset: 0 });
    expect(out.total).toBe(1);
    expect(out.data).toHaveLength(1);
    expect(out.data[0].code).toBe('WO-001');
    expect(out.data[0].jobBoard.state).toBe('AVAILABLE');
    expect(out.data[0]).not.toHaveProperty('createdBy');
  });

  it('fetchJobBoard 200: omits unset params from the query', async () => {
    const mock = jest.fn(async (url: string) => {
      expect(url).toBe('http://localhost:3000/api/v1/job-board');
      return jsonResponse({ data: [], total: 0, limit: 20, offset: 0 }, 200);
    });
    // eslint-disable-next-line no-native-reassign
    global.fetch = mock as unknown as typeof fetch;

    const out = await fetchJobBoard('tok-1');
    expect(out).toEqual({ data: [], total: 0, limit: 20, offset: 0 });
  });

  it('fetchJobBoard 400: surfaces the server message so screens can render the cause', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () =>
      jsonResponse({ message: 'limit phải nằm trong khoảng 1-100', statusCode: 400 }, 400),
    ) as unknown as typeof fetch;

    await expect(fetchJobBoard('tok-1', { limit: 0 })).rejects.toMatchObject({
      name: 'LoginError',
      status: 400,
      message: 'limit phải nằm trong khoảng 1-100',
    });
  });

  it('fetchJobBoard 400 (F006): forwards body.fieldErrors as the 4th LoginError arg', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () =>
      jsonResponse(
        {
          statusCode: 400,
          message: 'Limit không hợp lệ (1-100)',
          fieldErrors: { limit: ['Limit không hợp lệ (1-100)'] },
        },
        400,
      ),
    ) as unknown as typeof fetch;

    const err: LoginError = await fetchJobBoard('tok-1', { limit: 0 }).catch((e) => e);
    expect(err).toBeInstanceOf(LoginError);
    expect(err.status).toBe(400);
    expect(err.fieldErrors).toEqual({ limit: ['Limit không hợp lệ (1-100)'] });
  });

  it('fetchJobBoard 401: keeps the session-dead kind so screens can link back to login', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () =>
      jsonResponse({ message: 'Unauthorized', statusCode: 401 }, 401),
    ) as unknown as typeof fetch;

    await expect(fetchJobBoard('tok-1')).rejects.toMatchObject({
      name: 'LoginError',
      status: 401,
    });
  });

  it('fetchJobBoard network failure: stable Vietnamese fallback with status 0', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () => { throw new TypeError('Network request failed'); }) as unknown as typeof fetch;

    const err: LoginError = await fetchJobBoard('tok-1').catch((e) => e);
    expect(err).toBeInstanceOf(LoginError);
    expect(err.status).toBe(0);
    expect(err.message).toBe('Không thể kết nối máy chủ, vui lòng thử lại');
  });

  it('fetchWorkOrderPreview 200: GETs /api/v1/work-orders/:id with no-store', async () => {
    const mock = jest.fn(async (url: string, init?: { cache?: string }) => {
      expect(url).toContain('/api/v1/work-orders/wo-1');
      expect(init?.cache).toBe('no-store');
      return jsonResponse({ ...itemBody, id: 'wo-1', status: 'OPEN' }, 200);
    });
    // eslint-disable-next-line no-native-reassign
    global.fetch = mock as unknown as typeof fetch;

    const out = await fetchWorkOrderPreview('tok-1', 'wo-1');
    expect(out.id).toBe('wo-1');
    expect(out.jobBoard?.state).toBe('AVAILABLE');
  });

  it('fetchWorkOrderPreview network failure: stable fallback with status 0', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () => { throw new TypeError('Network request failed'); }) as unknown as typeof fetch;

    await expect(fetchWorkOrderPreview('tok-1', 'wo-1')).rejects.toMatchObject({
      name: 'LoginError',
      status: 0,
    });
  });
});
