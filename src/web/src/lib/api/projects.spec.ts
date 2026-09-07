import { createProject, updateProject, listProjects, getProject, toFieldErrors, changeProjectStatus } from './projects';

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

function profile(overrides = {}) {
  return {
    id: 'p-1',
    code: 'PRJ-001',
    name: 'Du an 1',
    description: null,
    address: 'So 1',
    timezone: 'Asia/Ho_Chi_Minh',
    plannedStartDate: '2026-01-01',
    plannedEndDate: '2026-12-31',
    managerId: 'm-1',
    managerName: null,
    status: 'DRAFT',
    createdBy: 'u-admin',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedBy: 'u-admin',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('projects api client PRJ-SRS-001 (issue #32)', () => {
  it('listProjects giữ chữ ký cũ (limit/offset, no-store)', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ id: 'p-1' }]));
    const data = await listProjects({ limit: 20, offset: 0 });
    expect(data).toEqual([{ id: 'p-1' }]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/projects?');
    expect(url).toContain('limit=20');
    expect(init.cache).toBe('no-store');
  });

  it('getProject giữ chữ ký cũ', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'p-1', code: 'PRJ-001' }));
    const data = await getProject('p-1');
    expect(data.code).toBe('PRJ-001');
  });

  it('createProject POST payload và trả ProjectProfile', async () => {
    fetchMock.mockResolvedValue(jsonResponse(profile(), 201));
    const res = await createProject({
      code: 'PRJ-001',
      name: 'Du an 1',
      address: 'So 1',
      plannedStartDate: '2026-01-01',
      plannedEndDate: '2026-12-31',
      managerId: 'm-1',
    });
    expect(res.status).toBe('DRAFT');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url.endsWith('/api/v1/projects')).toBe(true);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string).code).toBe('PRJ-001');
  });

  it('updateProject PATCH không mang code', async () => {
    fetchMock.mockResolvedValue(jsonResponse(profile({ name: 'Moi' })));
    const res = await updateProject('p-1', { name: 'Moi' });
    expect(res.name).toBe('Moi');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/projects/p-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).not.toHaveProperty('code');
  });

  it('409 PROJECT_CODE_DUPLICATE → fieldErrors.code', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ statusCode: 409, message: 'Mã dự án đã tồn tại', code: 'PROJECT_CODE_DUPLICATE' }, 409),
    );
    await expect(createProject({
      code: 'PRJ-001', name: 'x', address: 'y',
      plannedStartDate: '2026-01-01', plannedEndDate: '2026-12-31', managerId: 'm-1',
    })).rejects.toMatchObject({ status: 409, fieldErrors: { code: ['Mã dự án đã tồn tại'] } });
  });

  it('400 { message, fieldErrors } giữ nguyên fieldErrors server', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ statusCode: 400, message: 'Dữ liệu không hợp lệ', fieldErrors: { name: ['Tên bắt buộc'] } }, 400),
    );
    await expect(updateProject('p-1', { name: '' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { name: ['Tên bắt buộc'] },
    });
  });

  it('toFieldErrors an toàn shape lạ', () => {
    expect(toFieldErrors(null)).toBeUndefined();
    expect(toFieldErrors({ name: ['a'], n: 'b', x: 1 })).toEqual({ name: ['a'], n: ['b'] });
  });
});

describe('projects api client PRJ-SRS-002 (issue #33)', () => {
  it('changeProjectStatus PATCH :id/status, no-store, trả profile + alreadyInState', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...profile(), status: 'PAUSED', alreadyInState: false }));
    const res = await changeProjectStatus('p-1', { action: 'PAUSE', reason: 'Bao tri' });
    expect(res.status).toBe('PAUSED');
    expect(res.alreadyInState).toBe(false);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url.endsWith('/api/v1/projects/p-1/status')).toBe(true);
    expect(init.method).toBe('PATCH');
    expect(init.cache).toBe('no-store');
    expect(JSON.parse(init.body as string)).toEqual({ action: 'PAUSE', reason: 'Bao tri' });
  });

  it('alreadyInState:true giữ nguyên', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...profile(), status: 'ACTIVE', alreadyInState: true }));
    const res = await changeProjectStatus('p-1', { action: 'RESUME' });
    expect(res.alreadyInState).toBe(true);
  });

  it('409 INVALID_TRANSITION giữ allowedTransitions', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { statusCode: 409, message: 'Không thể chuyển dự án từ PAUSED với action CLOSE', code: 'INVALID_TRANSITION', allowedTransitions: ['RESUME'] },
        409,
      ),
    );
    await expect(changeProjectStatus('p-1', { action: 'CLOSE', reason: 'x' })).rejects.toMatchObject({
      status: 409,
      code: 'INVALID_TRANSITION',
      allowedTransitions: ['RESUME'],
    });
  });

  it('400 thiếu reason → fieldErrors.reason', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { statusCode: 400, message: 'Lý do là bắt buộc khi tạm dừng/đóng/mở lại dự án', fieldErrors: { reason: ['Lý do là bắt buộc khi tạm dừng/đóng/mở lại dự án'] } },
        400,
      ),
    );
    await expect(changeProjectStatus('p-1', { action: 'PAUSE' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { reason: ['Lý do là bắt buộc khi tạm dừng/đóng/mở lại dự án'] },
    });
  });
});
