import { fetchJobBoard, fetchJobBoardDetail, fetchWorkOrderPreview, LoginError } from './client';

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

describe('job board detail client (JOB-SRS-007, issue #47)', () => {
  const jsonResponse = (body: unknown, status: number) => ({
    ok: status < 400,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  });

  const detailBody = {
    id: 'wo-1',
    code: 'WO-001',
    title: 'Thi công dầm sàn',
    status: 'OPEN',
    priority: 'HIGH',
    projectId: '22222222-2222-4222-8222-222222222222',
    projectName: 'Dự án A',
    areaId: 'area-1',
    areaName: 'Khu A',
    workTypeId: 'wt-1',
    workTypeName: 'Bê tông cốt thép',
    workTypeDescription: 'Thi công bê tông',
    workTypeRequiredFields: ['bản vẽ'],
    workTypeGroup: 'BTCT',
    requiredTradeId: 'trade-1',
    requiredTradeName: 'Thợ cát',
    plannedStartAt: null,
    plannedEndAt: null,
    dueAt: null,
    plannedHeadcount: 5,
    jobBoard: { open: true, openFrom: null, openUntil: null, state: 'AVAILABLE' },
    description: 'Mô tả',
    instructions: 'Hướng dẫn',
    customFields: {},
    checklists: [],
    version: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
  };

  afterEach(() => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = globalThis.fetch;
  });

  it('fetchJobBoardDetail 200: GETs /api/v1/job-board/:id with Bearer + no-store, no PII', async () => {
    const mock = jest.fn(async (url: string, init?: { headers?: Record<string, string>; cache?: string }) => {
      expect(url).toBe('http://localhost:3000/api/v1/job-board/wo-1');
      expect(init?.headers?.Authorization).toBe('Bearer tok-1');
      expect(init?.cache).toBe('no-store');
      return jsonResponse(detailBody, 200);
    });
    // eslint-disable-next-line no-native-reassign
    global.fetch = mock as unknown as typeof fetch;

    const out = await fetchJobBoardDetail('tok-1', 'wo-1');
    expect(out.code).toBe('WO-001');
    expect(out.jobBoard?.state).toBe('AVAILABLE');
    expect(out).not.toHaveProperty('createdBy');
    expect(out).not.toHaveProperty('requestKey');
    expect(out).not.toHaveProperty('hasActiveAssignment');
  });

  it('fetchJobBoardDetail 403: permission kind (generic anti-leak, incl. unknown id)', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () =>
      jsonResponse({ message: 'Bạn không có quyền xem công việc này', statusCode: 403 }, 403),
    ) as unknown as typeof fetch;

    await expect(fetchJobBoardDetail('tok-1', 'wo-1')).rejects.toMatchObject({
      name: 'LoginError',
      status: 403,
    });
  });

  it('fetchJobBoardDetail 409: keeps code JOB_BOARD_CONFIG_INVALID for the config branch', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () =>
      jsonResponse({ code: 'JOB_BOARD_CONFIG_INVALID', message: 'Loại công việc không còn hợp lệ', statusCode: 409 }, 409),
    ) as unknown as typeof fetch;

    const err: LoginError = await fetchJobBoardDetail('tok-1', 'wo-1').catch((e) => e);
    expect(err).toBeInstanceOf(LoginError);
    expect(err.status).toBe(409);
    expect(err.code).toBe('JOB_BOARD_CONFIG_INVALID');
  });

  it('fetchJobBoardDetail 404/401: distinct kinds for gone vs session-dead', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () =>
      jsonResponse({ message: 'Not Found', statusCode: 404 }, 404),
    ) as unknown as typeof fetch;
    await expect(fetchJobBoardDetail('tok-1', 'wo-1')).rejects.toMatchObject({ status: 404 });

    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () =>
      jsonResponse({ message: 'Unauthorized', statusCode: 401 }, 401),
    ) as unknown as typeof fetch;
    await expect(fetchJobBoardDetail('tok-1', 'wo-1')).rejects.toMatchObject({ status: 401 });
  });

  it('fetchJobBoardDetail network failure: stable Vietnamese fallback with status 0', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () => { throw new TypeError('Network request failed'); }) as unknown as typeof fetch;

    const err: LoginError = await fetchJobBoardDetail('tok-1', 'wo-1').catch((e) => e);
    expect(err).toBeInstanceOf(LoginError);
    expect(err.status).toBe(0);
    expect(err.message).toBe('Không thể kết nối máy chủ, vui lòng thử lại');
  });

  it('F002 fetchJobBoardDetail malformed 200 body (missing title/code/workTypeName): LoginError 500', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () =>
      jsonResponse({ id: 'wo-1', code: 'WO-001', status: 'OPEN' }, 200),
    ) as unknown as typeof fetch;

    const err: LoginError = await fetchJobBoardDetail('tok-1', 'wo-1').catch((e) => e);
    expect(err).toBeInstanceOf(LoginError);
    expect(err.status).toBe(500);
    expect(err.message).toBe('Phản hồi chi tiết công việc không hợp lệ');
  });
});
