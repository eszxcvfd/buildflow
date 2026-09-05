import { listTrades, getTrade, createTrade, updateTrade, changeTradeStatus } from './trades';

function response(status: number, body: unknown, contentType = 'application/json') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    json: jest.fn(async () => body),
    text: jest.fn(async () => (typeof body === 'string' ? body : JSON.stringify(body))),
  } as unknown as Response;
}

const trade = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'TR-001',
  name: 'Tho xay',
  description: null,
  status: 'ACTIVE',
  assignable: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('web trade API client ORG-SRS-003', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.NEXT_PUBLIC_API_URL = 'http://api.example.test';
    window.localStorage.clear();
  });

  it('listTrades builds query and sends auth header; ALL status omitted', async () => {
    fetchMock.mockResolvedValue(response(200, { data: [trade], total: 1, limit: 20, offset: 0 }));
    window.localStorage.setItem('buildflow.auth.v1', JSON.stringify({ accessToken: 'jwt-1' }));
    await listTrades({ search: 'xay', status: 'ACTIVE', limit: 20, offset: 0 });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/trades?'), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer jwt-1' }),
    }));
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('search=xay');
    expect(url).toContain('status=ACTIVE');
    expect(url).toContain('limit=20');
    expect(url).toContain('offset=0');

    // status ALL = bỏ qua query → API mặc định trả ALL
    fetchMock.mockResolvedValueOnce(response(200, { data: [], total: 0, limit: 20, offset: 0 }));
    await listTrades({ status: 'ALL' });
    const url2 = fetchMock.mock.calls[1][0] as string;
    expect(url2).not.toContain('status=');
  });

  it('createTrade posts JSON; maps 400 validation array to fieldErrors', async () => {
    fetchMock.mockResolvedValueOnce(response(200, trade));
    const created = await createTrade({ code: 'TR-001', name: 'Tho xay', status: 'ACTIVE' });
    expect(created.code).toBe('TR-001');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/trades');
    expect((init as RequestInit).method).toBe('POST');

    fetchMock.mockResolvedValueOnce(response(400, { message: ['Mã ngành nghề không được để trống', 'Tên ngành nghề tối đa 120 ký tự'] }));
    await expect(createTrade({ code: '', name: '', status: 'ACTIVE' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: expect.objectContaining({
        code: expect.arrayContaining(['Mã ngành nghề không được để trống']),
        name: expect.arrayContaining(['Tên ngành nghề tối đa 120 ký tự']),
      }),
    });
  });

  it('maps 409 duplicate code onto the code field error (single-string message)', async () => {
    fetchMock.mockResolvedValueOnce(response(409, { message: 'Mã ngành nghề đã tồn tại' }));
    await expect(createTrade({ code: 'TR-001', name: 'Trung', status: 'ACTIVE' })).rejects.toMatchObject({
      status: 409,
      fieldErrors: { code: expect.arrayContaining(['Mã ngành nghề đã tồn tại']) },
    });
  });

  it('maps 400 single-string domain message onto its field', async () => {
    fetchMock.mockResolvedValueOnce(response(400, { message: 'Mô tả ngành nghề tối đa 500 ký tự' }));
    await expect(createTrade({ code: 'TR-002', name: 'A', description: 'x'.repeat(501), status: 'ACTIVE' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { description: expect.arrayContaining(['Mô tả ngành nghề tối đa 500 ký tự']) },
    });
  });

  it('preserves 401/403/404 for permission states', async () => {
    fetchMock.mockResolvedValueOnce(response(401, { message: 'Không có quyền truy cập' }));
    fetchMock.mockResolvedValueOnce(response(403, { message: 'Không có quyền truy cập' }));
    fetchMock.mockResolvedValueOnce(response(404, { message: 'Không tìm thấy' }));
    await expect(getTrade(trade.id)).rejects.toMatchObject({ status: 401 });
    await expect(getTrade(trade.id)).rejects.toMatchObject({ status: 403 });
    await expect(getTrade(trade.id)).rejects.toMatchObject({ status: 404 });
  });

  it('updateTrade PATCHes to /trades/:id', async () => {
    fetchMock.mockResolvedValue(response(200, trade));
    window.localStorage.setItem('buildflow.auth.v1', JSON.stringify({ accessToken: 'jwt-1' }));
    await updateTrade(trade.id, { name: 'Tho son' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(`/api/v1/trades/${trade.id}`);
    expect((init as RequestInit).method).toBe('PATCH');
    expect(JSON.parse(((init as RequestInit).body as string))).toEqual({ name: 'Tho son' });
  });

  it('changeTradeStatus PATCHes to /trades/:id/status and exposes warning from deactivate', async () => {
    fetchMock.mockResolvedValueOnce(response(200, { ...trade, status: 'INACTIVE', assignable: false, warning: 'Danh mục đang được tham chiếu bởi resource/loại công việc/work order đang hiệu lực' }));
    const updated = await changeTradeStatus(trade.id, { status: 'INACTIVE' });
    expect(updated.status).toBe('INACTIVE');
    expect(updated.assignable).toBe(false);
    expect(updated.warning).toContain('đang được tham chiếu');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(`/api/v1/trades/${trade.id}/status`);
    expect((init as RequestInit).method).toBe('PATCH');
  });
});
