import {
  searchWorkTypes,
  listActiveWorkTypes,
  getWorkType,
  createWorkType,
  updateWorkType,
  changeWorkTypeStatus,
  normalizeWorkType,
} from './work-types';

function response(status: number, body: unknown, contentType = 'application/json') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    json: jest.fn(async () => body),
    text: jest.fn(async () => (typeof body === 'string' ? body : JSON.stringify(body))),
  } as unknown as Response;
}

const raw = {
  id: '44444444-4444-4444-8444-444444444444',
  code: 'WT-001',
  name: 'Do be tong',
  description: null,
  group: 'Ket cau',
  requiredTradeId: null,
  requiredFields: [{ key: 'photos', label: 'Anh hien truong', type: 'PHOTO' }],
  configVersion: 1,
  defaultDurationMinutes: null,
  defaultPriority: 'NORMAL',
  status: 'ACTIVE',
  usableForNewWorkOrder: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('web work-type API client PRJ-SRS-004', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.NEXT_PUBLIC_API_URL = 'http://api.example.test';
    window.localStorage.clear();
  });

  it('normalizeWorkType suy isActive từ status', () => {
    expect(normalizeWorkType(raw).isActive).toBe(true);
    expect(normalizeWorkType({ ...raw, status: 'INACTIVE' }).isActive).toBe(false);
  });

  it('searchWorkTypes dựng query status/group/tradeId/search + auth; ALL bỏ status', async () => {
    fetchMock.mockResolvedValue(response(200, { data: [raw], total: 1, limit: 20, offset: 0 }));
    window.localStorage.setItem('buildflow.auth.v1', JSON.stringify({ accessToken: 'jwt-1' }));
    const res = await searchWorkTypes({
      search: 'tong',
      status: 'ACTIVE',
      group: 'Ket cau',
      tradeId: '11111111-1111-4111-8111-111111111111',
      limit: 20,
      offset: 0,
    });
    expect(res.data[0].isActive).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/work-types?');
    expect(url).toContain('search=tong');
    expect(url).toContain('status=ACTIVE');
    expect(url).toContain('group=Ket+cau');
    expect(url).toContain('tradeId=11111111-1111-4111-8111-111111111111');
    expect((init as RequestInit).headers).toEqual(expect.objectContaining({ Authorization: 'Bearer jwt-1' }));

    fetchMock.mockResolvedValueOnce(response(200, { data: [], total: 0, limit: 20, offset: 0 }));
    await searchWorkTypes({ status: 'ALL' });
    expect(String(fetchMock.mock.calls[1][0])).not.toContain('status=');
  });

  it('listActiveWorkTypes gọi /active với cache no-store', async () => {
    fetchMock.mockResolvedValue(response(200, { data: [raw], total: 1 }));
    const res = await listActiveWorkTypes();
    expect(res.total).toBe(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/work-types/active');
    expect((init as RequestInit).cache).toBe('no-store');
  });

  it('getWorkType trả profile kèm usage', async () => {
    fetchMock.mockResolvedValue(response(200, { ...raw, usage: { workOrders: 2 } }));
    const wt = await getWorkType(raw.id);
    expect(wt.usage).toEqual({ workOrders: 2 });
    expect(wt.configVersion).toBe(1);
    expect(wt.requiredFields).toHaveLength(1);
  });

  it('createWorkType POST JSON; 409 trùng code map về field code', async () => {
    fetchMock.mockResolvedValueOnce(response(201, raw));
    const created = await createWorkType({ code: 'WT-001', name: 'Do be tong' });
    expect(created.code).toBe('WT-001');
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('POST');

    fetchMock.mockResolvedValueOnce(
      response(409, { message: 'Mã loại công việc đã tồn tại', code: 'WORK_TYPE_CODE_DUPLICATE' }),
    );
    await expect(createWorkType({ code: 'WT-001', name: 'Khac' })).rejects.toMatchObject({
      status: 409,
      fieldErrors: { code: expect.arrayContaining(['Mã loại công việc đã tồn tại']) },
    });
  });

  it('updateWorkType PATCH và trả versionChanged; 409 xung đột map về expectedConfigVersion', async () => {
    fetchMock.mockResolvedValueOnce(response(200, { ...raw, configVersion: 2, versionChanged: true }));
    const res = await updateWorkType(raw.id, { name: 'Moi', expectedConfigVersion: 1 });
    expect(res.versionChanged).toBe(true);
    expect(res.workType.configVersion).toBe(2);
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('PATCH');

    fetchMock.mockResolvedValueOnce(
      response(409, { message: 'Cấu hình đã được người khác cập nhật', code: 'WORK_TYPE_CONFIG_CONFLICT' }),
    );
    await expect(updateWorkType(raw.id, { name: 'Moi', expectedConfigVersion: 1 })).rejects.toMatchObject({
      status: 409,
      fieldErrors: { expectedConfigVersion: expect.any(Array) },
    });
  });

  it('changeWorkTypeStatus POST /:id/status với action; giữ alreadyInState + warning', async () => {
    fetchMock.mockResolvedValueOnce(response(200, { ...raw, status: 'INACTIVE', alreadyInState: true }));
    const wt = await changeWorkTypeStatus(raw.id, { action: 'DEACTIVATE', reason: 'Tam dung' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(`/api/v1/work-types/${raw.id}/status`);
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ action: 'DEACTIVATE', reason: 'Tam dung' });
    expect(wt.alreadyInState).toBe(true);
    expect(wt.isActive).toBe(false);
  });

  it('giữ fieldErrors API shape mới { message, fieldErrors }', async () => {
    fetchMock.mockResolvedValueOnce(
      response(400, { message: 'Dữ liệu không hợp lệ', fieldErrors: { requiredTradeId: ['Ngành nghề yêu cầu không tồn tại'] } }),
    );
    await expect(createWorkType({ code: 'WT-002', name: 'X' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { requiredTradeId: ['Ngành nghề yêu cầu không tồn tại'] },
    });
  });
});
