import { listProjectAreas, createProjectArea, updateProjectArea, toFieldErrors } from './projects';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

const fetchMock = jest.fn();
(global as unknown as { fetch: unknown }).fetch = fetchMock;

beforeEach(() => {
  jest.clearAllMocks();
});

function area(overrides = {}) {
  return {
    id: 'a-1',
    projectId: 'p-1',
    code: 'T1-A',
    name: 'Tang 1 — Khu A',
    isActive: true,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('projects api client PRJ-SRS-003 (issue #34)', () => {
  it('listProjectAreas GET :projectId/areas, no-store, default không activeOnly', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [area()], total: 1 }));
    const res = await listProjectAreas('p-1');
    expect(res.total).toBe(1);
    expect(res.data[0].name).toBe('Tang 1 — Khu A');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url.endsWith('/api/v1/projects/p-1/areas')).toBe(true);
    expect(url).not.toContain('activeOnly');
    expect(init.cache).toBe('no-store');
  });

  it('listProjectAreas activeOnly=true gắn query', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [], total: 0 }));
    await listProjectAreas('p-1', { activeOnly: true });
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('activeOnly=true');
  });

  it('createProjectArea POST payload {name, code} → 201', async () => {
    fetchMock.mockResolvedValue(jsonResponse(area(), 201));
    const res = await createProjectArea('p-1', { name: 'Tang 1 — Khu A', code: 'T1-A' });
    expect(res.code).toBe('T1-A');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url.endsWith('/api/v1/projects/p-1/areas')).toBe(true);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Tang 1 — Khu A', code: 'T1-A' });
  });

  it('createProjectArea không mã → payload không mang code', async () => {
    fetchMock.mockResolvedValue(jsonResponse(area({ code: null }), 201));
    const res = await createProjectArea('p-1', { name: 'Khu B' });
    expect(res.code).toBeNull();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Khu B' });
  });

  it('409 AREA_DUPLICATE → fieldErrors.name, giữ code', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ statusCode: 409, message: 'Tên khu vực đã tồn tại trong dự án', code: 'AREA_DUPLICATE' }, 409),
    );
    await expect(createProjectArea('p-1', { name: 'Tang 1' })).rejects.toMatchObject({
      status: 409,
      code: 'AREA_DUPLICATE',
      fieldErrors: { name: ['Tên khu vực đã tồn tại trong dự án'] },
    });
  });

  it('409 AREA_CODE_DUPLICATE → fieldErrors.code, giữ code', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ statusCode: 409, message: 'Mã khu vực đã tồn tại trong dự án', code: 'AREA_CODE_DUPLICATE' }, 409),
    );
    await expect(createProjectArea('p-1', { name: 'Tang 1', code: 'T1-A' })).rejects.toMatchObject({
      status: 409,
      code: 'AREA_CODE_DUPLICATE',
      fieldErrors: { code: ['Mã khu vực đã tồn tại trong dự án'] },
    });
  });

  it('updateProjectArea PATCH :projectId/areas/:areaId + alreadyInactive', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...area(), isActive: false, alreadyInactive: true }));
    const res = await updateProjectArea('p-1', 'a-1', { isActive: false });
    expect(res.isActive).toBe(false);
    expect(res.alreadyInactive).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url.endsWith('/api/v1/projects/p-1/areas/a-1')).toBe(true);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ isActive: false });
  });

  it('updateProjectArea retire giữ usage/warning từ API (PRJ-SRS-007 #38)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...area(),
        isActive: false,
        alreadyInactive: false,
        usage: { workOrders: 2 },
        warning: 'Khu vực đang được tham chiếu bởi work order đang hiệu lực',
      }),
    );
    const res = await updateProjectArea('p-1', 'a-1', { isActive: false, reason: null });
    expect(res.alreadyInactive).toBe(false);
    expect(res.usage).toEqual({ workOrders: 2 });
    expect(res.warning).toContain('work order');
  });

  it('400 { message, fieldErrors } giữ nguyên fieldErrors server', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ statusCode: 400, message: 'Dữ liệu không hợp lệ', fieldErrors: { name: ['Tên bắt buộc'] } }, 400),
    );
    await expect(updateProjectArea('p-1', 'a-1', { name: '' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { name: ['Tên bắt buộc'] },
    });
  });

  it('404 dự án truyền message server', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ statusCode: 404, message: 'Không tìm thấy dự án' }, 404),
    );
    await expect(listProjectAreas('p-404')).rejects.toMatchObject({
      status: 404,
      message: 'Không tìm thấy dự án',
    });
  });

  it('toFieldErrors export dùng chung vẫn an toàn shape lạ', () => {
    expect(toFieldErrors(null)).toBeUndefined();
  });
});
