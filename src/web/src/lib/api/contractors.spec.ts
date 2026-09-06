import {
  listContractors,
  getContractor,
  createContractor,
  updateContractor,
  changeContractorLifecycleStatus,
  getContractorOpenWork,
  type Contractor,
} from './contractors';

function makeContractor(overrides: Partial<Contractor> = {}): Contractor {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'CTR-001',
    name: 'Alpha',
    contactName: 'Nguyen Van A',
    phone: '+84901234567',
    email: 'a@example.com',
    status: 'ACTIVE',
    scope: 'Thi cong phan tho',
    eligible: true,
    createdBy: 'u-admin',
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

describe('web contractor API client ORG-SRS-002', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.NEXT_PUBLIC_API_URL = 'http://api.example.test';
    window.localStorage.clear();
  });

  it('listContractors builds query and sends auth header', async () => {
    fetchMock.mockResolvedValue(response(200, { data: [], total: 0, limit: 20, offset: 0 }));
    window.localStorage.setItem('buildflow.auth.v1', JSON.stringify({ accessToken: 'jwt-1' }));
    await listContractors({ search: 'alpha', status: 'ACTIVE', scope: 'phan tho', eligibleOnly: true, limit: 20, offset: 0 });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/contractors?'), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer jwt-1' }),
    }));
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('search=alpha');
    expect(url).toContain('status=ACTIVE');
    expect(url).toContain('scope=');
    expect(url).toContain('eligibleOnly=true');
  });

  it('maps 400 validation arrays to fieldErrors (thiếu contact/scope → field error)', async () => {
    fetchMock.mockResolvedValue(response(400, { message: ['Thông tin liên hệ không được để trống', 'Phạm vi công việc không được để trống'] }));
    await expect(createContractor({ code: 'CTR-001', name: 'Alpha', contactName: '', scope: '', phone: null, email: null })).rejects.toMatchObject({
      status: 400,
      fieldErrors: expect.objectContaining({
        contactName: expect.arrayContaining(['Thông tin liên hệ không được để trống']),
        scope: expect.arrayContaining(['Phạm vi công việc không được để trống']),
      }),
    });
  });

  it('preserves 401/403 for permission states', async () => {
    fetchMock.mockResolvedValue(response(401, { message: 'Không có quyền truy cập' }));
    await expect(getContractor('11111111-1111-4111-8111-111111111111')).rejects.toMatchObject({ status: 401 });
    fetchMock.mockResolvedValue(response(403, { message: 'Không có quyền truy cập' }));
    await expect(getContractor('11111111-1111-4111-8111-111111111111')).rejects.toMatchObject({ status: 403 });
  });

  it('updateContractor sends PATCH with JSON and maps 409 duplicate code', async () => {
    fetchMock.mockResolvedValue(response(409, { message: 'Mã nhà thầu đã tồn tại' }));
    window.localStorage.setItem('buildflow.auth.v1', JSON.stringify({ accessToken: 'jwt-1' }));
    await expect(updateContractor('11111111-1111-4111-8111-111111111111', { code: 'CTR-001' })).rejects.toMatchObject({ status: 409, message: 'Mã nhà thầu đã tồn tại' });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/contractors/11111111-1111-4111-8111-111111111111'), expect.objectContaining({ method: 'PATCH' }));
  });

  it('listContractors success returns data with eligible flag', async () => {
    const payload = { data: [{ id: '1', code: 'CTR-001', name: 'Alpha', contactName: 'A', phone: null, email: null, status: 'ACTIVE', scope: 'Thi cong', eligible: true, createdBy: 'u1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }], total: 1, limit: 20, offset: 0 };
    fetchMock.mockResolvedValue(response(200, payload));
    const res = await listContractors({});
    expect(res.data[0].eligible).toBe(true);
    expect(res.total).toBe(1);
  });

  describe('sort/order + fieldErrors (ORG-SRS-005, issue #28)', () => {
    it('listContractors gửi sort/order query params', async () => {
      fetchMock.mockResolvedValue(response(200, { data: [], total: 0, limit: 20, offset: 0 }));
      await listContractors({ status: 'ACTIVE', sort: 'name', order: 'asc', limit: 20, offset: 0 });
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('sort=name');
      expect(url).toContain('order=asc');
    });

    it('giữ nguyên fieldErrors shape mới { message, fieldErrors } của API 400', async () => {
      fetchMock.mockResolvedValue(response(400, {
        statusCode: 400,
        message: 'Sort không hợp lệ (name|createdAt)',
        fieldErrors: { sort: ['Sort không hợp lệ (name|createdAt)'] },
      }));
      await expect(listContractors({ sort: 'hacked' })).rejects.toMatchObject({
        status: 400,
        fieldErrors: { sort: ['Sort không hợp lệ (name|createdAt)'] },
      });
    });
  });

  describe('lifecycle status (ORG-SRS-004, issue #27)', () => {
    it('changeContractorLifecycleStatus PATCHes /contractors/:id/status với action + reason', async () => {
      const profile = makeContractor({ status: 'INACTIVE', eligible: false });
      fetchMock.mockResolvedValue(response(200, { ...profile, alreadyInState: false, warning: { openAssignments: 2 } }));
      const res = await changeContractorLifecycleStatus('11111111-1111-4111-8111-111111111111', { action: 'TERMINATE', reason: 'Hết hợp đồng' });
      expect(res.status).toBe('INACTIVE');
      expect(res.eligible).toBe(false);
      expect(res.alreadyInState).toBe(false);
      expect(res.warning?.openAssignments).toBe(2);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/v1/contractors/11111111-1111-4111-8111-111111111111/status');
      expect((init as RequestInit).method).toBe('PATCH');
      expect(JSON.parse(String((init as RequestInit).body))).toEqual({ action: 'TERMINATE', reason: 'Hết hợp đồng' });
    });

    it('maps 400 thiếu lý do → fieldErrors.reason (hiển thị theo field)', async () => {
      fetchMock.mockResolvedValue(response(400, { message: 'Lý do là bắt buộc khi tạm ngừng/chấm dứt' }));
      await expect(changeContractorLifecycleStatus('11111111-1111-4111-8111-111111111111', { action: 'SUSPEND' })).rejects.toMatchObject({
        status: 400,
        message: 'Lý do là bắt buộc khi tạm ngừng/chấm dứt',
        fieldErrors: expect.objectContaining({ reason: expect.arrayContaining(['Lý do là bắt buộc khi tạm ngừng/chấm dứt']) }),
      });
    });

    it('parses alreadyInState:true (request lặp — không báo lỗi, không audit trùng)', async () => {
      fetchMock.mockResolvedValue(response(200, { ...makeContractor(), alreadyInState: true }));
      const res = await changeContractorLifecycleStatus('11111111-1111-4111-8111-111111111111', { action: 'ACTIVATE', reason: null });
      expect(res.alreadyInState).toBe(true);
      expect(res.warning).toBeNull();
    });

    it('getContractorOpenWork GETs /contractors/:id/open-work và trả số công việc mở', async () => {
      fetchMock.mockResolvedValue(response(200, { openAssignments: 4 }));
      const res = await getContractorOpenWork('11111111-1111-4111-8111-111111111111');
      expect(res.openAssignments).toBe(4);
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/v1/contractors/11111111-1111-4111-8111-111111111111/open-work');
    });

    it('preserves 403 from lifecycle endpoints', async () => {
      fetchMock.mockResolvedValue(response(403, { message: 'Không có quyền truy cập' }));
      await expect(changeContractorLifecycleStatus('11111111-1111-4111-8111-111111111111', { action: 'SUSPEND', reason: 'x' })).rejects.toMatchObject({ status: 403 });
      fetchMock.mockResolvedValue(response(403, { message: 'Không có quyền truy cập' }));
      await expect(getContractorOpenWork('11111111-1111-4111-8111-111111111111')).rejects.toMatchObject({ status: 403 });
    });
  });
});
