import {
  listWorkers,
  getWorker,
  type Worker,
} from './workers';

function makeWorker(overrides: Partial<Worker> = {}): Worker {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'w@example.com',
    fullName: 'Nguyen Van W',
    phone: '+84901234567',
    avatarUrl: null,
    employeeCode: 'NV-001',
    userType: 'WORKER',
    contractorId: null,
    status: 'ACTIVE',
    trades: [],
    eligible: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function response(status: number, body: unknown, contentType = 'application/json') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => name === 'content-type' ? contentType : null },
    json: jest.fn(async () => body),
    text: jest.fn(async () => String(body)),
  } as unknown as Response;
}

describe('web worker API client ORG-SRS-005 (issue #28)', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.NEXT_PUBLIC_API_URL = 'http://api.example.test';
    window.localStorage.clear();
  });

  it('listWorkers gửi sort/order/filter kết hợp + auth header', async () => {
    fetchMock.mockResolvedValue(response(200, { data: [], total: 0, limit: 20, offset: 0 }));
    window.localStorage.setItem('buildflow.auth.v1', JSON.stringify({ accessToken: 'jwt-1' }));
    await listWorkers({
      search: 'nguyen',
      status: 'ACTIVE',
      tradeId: '22222222-2222-4222-8222-222222222222',
      skillLevel: 3,
      sort: 'name',
      order: 'asc',
      limit: 20,
      offset: 20,
    });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/workers?'), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer jwt-1' }),
    }));
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('search=nguyen');
    expect(url).toContain('status=ACTIVE');
    expect(url).toContain('tradeId=22222222-2222-4222-8222-222222222222');
    expect(url).toContain('skillLevel=3');
    expect(url).toContain('sort=name');
    expect(url).toContain('order=asc');
    expect(url).toContain('limit=20');
    expect(url).toContain('offset=20');
  });

  it('listWorkers không gửi sort/order khi không truyền', async () => {
    fetchMock.mockResolvedValue(response(200, { data: [], total: 0, limit: 20, offset: 0 }));
    await listWorkers({ status: 'ACTIVE' });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('status=ACTIVE');
    expect(url).not.toContain('sort=');
    expect(url).not.toContain('order=');
  });

  it('ORG-SRS-007 (issue #30, D9) — listWorkers gửi crewId khi lọc theo đội', async () => {
    fetchMock.mockResolvedValue(response(200, { data: [], total: 0, limit: 20, offset: 0 }));
    await listWorkers({ crewId: '33333333-3333-4333-8333-333333333333' });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('crewId=33333333-3333-4333-8333-333333333333');
  });

  it('giữ nguyên fieldErrors shape mới { message, fieldErrors } của API 400', async () => {
    fetchMock.mockResolvedValue(response(400, {
      statusCode: 400,
      message: 'Trạng thái không hợp lệ',
      fieldErrors: { status: ['Trạng thái không hợp lệ'] },
    }));
    await expect(listWorkers({ status: 'WRONG' })).rejects.toMatchObject({
      status: 400,
      message: 'Trạng thái không hợp lệ',
      fieldErrors: { status: ['Trạng thái không hợp lệ'] },
    });
  });

  it('giữ nguyên fieldErrors sort/order sai từ API 400', async () => {
    fetchMock.mockResolvedValue(response(400, {
      statusCode: 400,
      message: 'Sort không hợp lệ (name|createdAt)',
      fieldErrors: { sort: ['Sort không hợp lệ (name|createdAt)'] },
    }));
    await expect(listWorkers({ sort: 'hacked' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { sort: ['Sort không hợp lệ (name|createdAt)'] },
    });
  });

  it('tương thích message-only cũ (không fieldErrors → undefined)', async () => {
    fetchMock.mockResolvedValue(response(403, { message: 'Không có quyền truy cập' }));
    await expect(getWorker('11111111-1111-4111-8111-111111111111')).rejects.toMatchObject({ status: 403 });
    const err = await getWorker('11111111-1111-4111-8111-111111111111').catch((e) => e);
    expect(err.fieldErrors).toBeUndefined();
  });

  it('listWorkers success trả data + total', async () => {
    fetchMock.mockResolvedValue(response(200, { data: [makeWorker()], total: 1, limit: 20, offset: 0 }));
    const res = await listWorkers({});
    expect(res.data).toHaveLength(1);
    expect(res.total).toBe(1);
  });
});
