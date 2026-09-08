import { createWorkOrder, getWorkOrder, newCorrelationId } from './work-orders';

function response(status: number, body: unknown, contentType = 'application/json') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    json: jest.fn(async () => body),
    text: jest.fn(async () => (typeof body === 'string' ? body : JSON.stringify(body))),
  } as unknown as Response;
}

const UUID = '11111111-1111-4111-8111-111111111111';
const TYPE_ID = '22222222-2222-4222-8222-222222222222';

const raw = {
  id: '33333333-3333-4333-8333-333333333333',
  code: 'WO-ABC123',
  projectId: UUID,
  areaId: null,
  workTypeId: TYPE_ID,
  requiredTradeId: null,
  title: 'Do be tong cot C1',
  description: null,
  instructions: null,
  priority: 'NORMAL',
  status: 'DRAFT',
  plannedStartAt: null,
  plannedEndAt: null,
  plannedHeadcount: null,
  createdBy: 'u-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  version: 1,
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('web work-order API client JOB-SRS-001', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.NEXT_PUBLIC_API_URL = 'http://api.example.test';
    window.localStorage.clear();
  });

  it('newCorrelationId sinh UUID hợp lệ', () => {
    expect(newCorrelationId()).toMatch(UUID_RE);
  });

  it('createWorkOrder POST JSON + Bearer + X-Correlation-Id; 201 → replay false', async () => {
    fetchMock.mockResolvedValueOnce(response(201, raw));
    window.localStorage.setItem('buildflow.auth.v1', JSON.stringify({ accessToken: 'jwt-1' }));
    const res = await createWorkOrder(
      { projectId: UUID, workTypeId: TYPE_ID, title: 'Do be tong', requestKey: UUID },
      { correlationId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' },
    );
    expect(res.workOrder.code).toBe('WO-ABC123');
    expect(res.idempotentReplay).toBe(false);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.example.test/api/v1/work-orders');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer jwt-1');
    expect(headers['X-Correlation-Id']).toBe('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      projectId: UUID,
      workTypeId: TYPE_ID,
      title: 'Do be tong',
      requestKey: UUID,
    });
  });

  it('createWorkOrder tự sinh X-Correlation-Id dạng UUID khi không override', async () => {
    fetchMock.mockResolvedValueOnce(response(201, raw));
    await createWorkOrder({ projectId: UUID, workTypeId: TYPE_ID, title: 'X' });
    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['X-Correlation-Id']).toMatch(UUID_RE);
  });

  it('200 + idempotentReplay:true → replay true (không tạo mới)', async () => {
    fetchMock.mockResolvedValueOnce(response(200, { ...raw, idempotentReplay: true }));
    const res = await createWorkOrder({ projectId: UUID, workTypeId: TYPE_ID, title: 'X', requestKey: UUID });
    expect(res.idempotentReplay).toBe(true);
    expect(res.workOrder.id).toBe(raw.id);
  });

  it('400 fieldErrors server được giữ nguyên theo field', async () => {
    fetchMock.mockResolvedValueOnce(
      response(400, {
        message: 'Dữ liệu không hợp lệ',
        fieldErrors: { workTypeId: ['Loại công việc không tồn tại hoặc đã ngừng hoạt động'] },
      }),
    );
    await expect(
      createWorkOrder({ projectId: UUID, workTypeId: TYPE_ID, title: 'X' }),
    ).rejects.toMatchObject({
      status: 400,
      fieldErrors: { workTypeId: ['Loại công việc không tồn tại hoặc đã ngừng hoạt động'] },
    });
  });

  it('400 single-string planned range map về plannedEndAt', async () => {
    fetchMock.mockResolvedValueOnce(
      response(400, { message: 'Thời điểm kết thúc kế hoạch phải sau thời điểm bắt đầu' }),
    );
    await expect(
      createWorkOrder({ projectId: UUID, workTypeId: TYPE_ID, title: 'X' }),
    ).rejects.toMatchObject({
      status: 400,
      fieldErrors: { plannedEndAt: expect.any(Array) },
    });
  });

  it('409 WORK_ORDER_CODE_DUPLICATE map về field code', async () => {
    fetchMock.mockResolvedValueOnce(
      response(409, { message: 'Mã công việc đã tồn tại', code: 'WORK_ORDER_CODE_DUPLICATE' }),
    );
    await expect(
      createWorkOrder({ projectId: UUID, workTypeId: TYPE_ID, title: 'X', code: 'WO-DUP' }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'WORK_ORDER_CODE_DUPLICATE',
      fieldErrors: { code: ['Mã công việc đã tồn tại'] },
    });
  });

  it('403 ngoài scope + 401 hết phiên giữ message', async () => {
    fetchMock.mockResolvedValueOnce(response(403, { message: 'Không có quyền tạo work order trong dự án này' }));
    await expect(
      createWorkOrder({ projectId: UUID, workTypeId: TYPE_ID, title: 'X' }),
    ).rejects.toMatchObject({ status: 403 });

    fetchMock.mockResolvedValueOnce(response(401, { message: 'Phiên hết hạn, vui lòng đăng nhập lại' }));
    await expect(
      createWorkOrder({ projectId: UUID, workTypeId: TYPE_ID, title: 'X' }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('getWorkOrder GET no-store + Bearer; 403 non-member', async () => {
    fetchMock.mockResolvedValueOnce(response(200, raw));
    window.localStorage.setItem('buildflow.auth.v1', JSON.stringify({ accessToken: 'jwt-9' }));
    const wo = await getWorkOrder(raw.id);
    expect(wo.code).toBe('WO-ABC123');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`http://api.example.test/api/v1/work-orders/${raw.id}`);
    expect((init as RequestInit).cache).toBe('no-store');
    expect((init as RequestInit).headers).toEqual(expect.objectContaining({ Authorization: 'Bearer jwt-9' }));

    fetchMock.mockResolvedValueOnce(response(403, { message: 'Không có quyền xem work order này' }));
    await expect(getWorkOrder(raw.id)).rejects.toMatchObject({ status: 403 });
  });
});
