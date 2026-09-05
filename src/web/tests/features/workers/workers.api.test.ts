import {
  listWorkers,
  getWorker,
  createWorker,
  updateWorker,
  type Worker,
} from '@/lib/api/workers';

const sampleWorker: Worker = {
  id: 'w-1',
  email: 'worker@b.com',
  fullName: 'Nguyen Van Tho',
  phone: null,
  avatarUrl: null,
  employeeCode: 'EMP-01',
  userType: 'WORKER',
  contractorId: null,
  status: 'ACTIVE',
  trades: [{ tradeId: '11111111-1111-4111-8111-111111111111', skillLevel: 3 }],
  eligible: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function mockJsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

function setFetchMock(fn: jest.Mock) {
  (global as unknown as { fetch: unknown }).fetch = fn;
}

describe('workers API client (ORG-SRS-001)', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
    localStorage.setItem(
      'buildflow.auth.v1',
      JSON.stringify({ accessToken: 'tok123', expiresAt: new Date(Date.now() + 3600000).toISOString() }),
    );
    process.env.NEXT_PUBLIC_API_URL = 'http://api.example.test';
  });

  it('listWorkers builds query params and sends Bearer token', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(mockJsonResponse(200, { data: [sampleWorker], total: 1, limit: 20, offset: 0 }));
    setFetchMock(fetchMock);
    const res = await listWorkers({ status: 'ACTIVE', search: 'Tho', skillLevel: 3, limit: 20, offset: 0 });
    expect(res.total).toBe(1);
    expect(res.data[0].eligible).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/workers?');
    expect(url).toContain('status=ACTIVE');
    expect(url).toContain('search=Tho');
    expect(url).toContain('skillLevel=3');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok123' });
  });

  it('createWorker posts JSON with payload and maps 409 duplicate identity', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(mockJsonResponse(201, sampleWorker))
      .mockResolvedValueOnce(mockJsonResponse(409, { message: 'Mã nhân viên đã tồn tại' }));
    setFetchMock(fetchMock);
    const created = await createWorker({ email: 'worker@b.com', password: 'Secret123!', fullName: 'Nguyen Van Tho', employeeCode: 'EMP-01', trades: [{ tradeId: '11111111-1111-4111-8111-111111111111', skillLevel: 3 }] });
    expect(created.employeeCode).toBe('EMP-01');
    const [url1, init1] = fetchMock.mock.calls[0];
    expect(url1).toContain('/api/v1/workers');
    expect((init1 as RequestInit).method).toBe('POST');
    await expect(createWorker({ email: 'dup@b.com', password: 'Secret123!', fullName: 'Dup', employeeCode: 'EMP-01' }))
      .rejects.toMatchObject({ status: 409, message: 'Mã nhân viên đã tồn tại' });
  });

  it('updateWorker PATCHes and maps validation array to fieldErrors', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(mockJsonResponse(200, { ...sampleWorker, fullName: 'Renamed' }))
      .mockResolvedValueOnce(mockJsonResponse(400, { message: ['Họ tên không được để trống'] }));
    setFetchMock(fetchMock);
    const updated = await updateWorker('w-1', { fullName: 'Renamed' });
    expect(updated.fullName).toBe('Renamed');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/workers/w-1');
    expect((init as RequestInit).method).toBe('PATCH');
    await expect(updateWorker('w-1', { fullName: '' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: expect.objectContaining({ fullName: expect.arrayContaining(['Họ tên không được để trống']) }),
    });
  });

  it('getWorker preserves 401/403/404 for permission states', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(mockJsonResponse(401, { message: 'Phiên hết hạn' }))
      .mockResolvedValueOnce(mockJsonResponse(403, { message: 'Không có quyền truy cập' }))
      .mockResolvedValueOnce(mockJsonResponse(404, { message: 'Không tìm thấy' }));
    setFetchMock(fetchMock);
    await expect(getWorker('w-1')).rejects.toMatchObject({ status: 401 });
    await expect(getWorker('w-1')).rejects.toMatchObject({ status: 403 });
    await expect(getWorker('w-1')).rejects.toMatchObject({ status: 404 });
  });

  it('createWorker maps 400 validation array to email/password fieldErrors', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(mockJsonResponse(400, {
      message: ['Email không hợp lệ', 'Mật khẩu tối thiểu 8 ký tự'],
    }));
    setFetchMock(fetchMock);
    await expect(createWorker({ email: 'bad', password: 'short', fullName: 'X' }))
      .rejects.toMatchObject({
        status: 400,
        fieldErrors: expect.objectContaining({
          email: expect.arrayContaining(['Email không hợp lệ']),
          password: expect.arrayContaining(['Mật khẩu tối thiểu 8 ký tự']),
        }),
      });
  });
});
