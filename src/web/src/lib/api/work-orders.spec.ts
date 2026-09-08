import { createWorkOrder, getWorkOrder, newCorrelationId, searchWorkOrders, updateWorkOrder } from './work-orders';

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
  dueAt: null,
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

describe('web work-order API client JOB-SRS-003', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.NEXT_PUBLIC_API_URL = 'http://api.example.test';
    window.localStorage.clear();
  });

  it('updateWorkOrder PATCH JSON + Bearer + X-Correlation-Id + expectedVersion/reason', async () => {
    fetchMock.mockResolvedValueOnce(response(200, { ...raw, version: 2 }));
    window.localStorage.setItem('buildflow.auth.v1', JSON.stringify({ accessToken: 'jwt-1' }));
    const wo = await updateWorkOrder(
      raw.id,
      { description: 'Moi', expectedVersion: 1, reason: 'Ly do' },
      { correlationId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' },
    );
    expect(wo.version).toBe(2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`http://api.example.test/api/v1/work-orders/${raw.id}`);
    expect((init as RequestInit).method).toBe('PATCH');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer jwt-1');
    expect(headers['X-Correlation-Id']).toBe('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      description: 'Moi',
      expectedVersion: 1,
      reason: 'Ly do',
    });
  });

  it('updateWorkOrder tự sinh X-Correlation-Id dạng UUID khi không override', async () => {
    fetchMock.mockResolvedValueOnce(response(200, raw));
    await updateWorkOrder(raw.id, { description: 'X', expectedVersion: 1 });
    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['X-Correlation-Id']).toMatch(UUID_RE);
  });

  it('400 WORK_ORDER_FIELD_LOCKED giữ nguyên fieldErrors từng field', async () => {
    fetchMock.mockResolvedValueOnce(
      response(400, {
        message: 'Field bị khóa ở trạng thái hiện tại',
        code: 'WORK_ORDER_FIELD_LOCKED',
        fieldErrors: { priority: ['Ưu tiên bị khóa ở trạng thái OPEN'] },
      }),
    );
    await expect(updateWorkOrder(raw.id, { priority: 'HIGH', expectedVersion: 1 })).rejects.toMatchObject({
      status: 400,
      code: 'WORK_ORDER_FIELD_LOCKED',
      fieldErrors: { priority: ['Ưu tiên bị khóa ở trạng thái OPEN'] },
    });
  });

  it('400 WORK_ORDER_REASON_REQUIRED giữ fieldErrors.reason', async () => {
    fetchMock.mockResolvedValueOnce(
      response(400, {
        message: 'Thiếu lý do',
        code: 'WORK_ORDER_REASON_REQUIRED',
        fieldErrors: { reason: ['Đổi lịch bắt buộc kèm lý do'] },
      }),
    );
    await expect(updateWorkOrder(raw.id, { plannedStartAt: '2026-02-01T00:00:00.000Z', expectedVersion: 2 })).rejects.toMatchObject({
      status: 400,
      code: 'WORK_ORDER_REASON_REQUIRED',
      fieldErrors: { reason: ['Đổi lịch bắt buộc kèm lý do'] },
    });
  });

  it('409 WORK_ORDER_CONFLICT map về fieldErrors.expectedVersion', async () => {
    fetchMock.mockResolvedValueOnce(
      response(409, {
        message: 'Work order đã được người khác cập nhật (version hiện tại 3)',
        code: 'WORK_ORDER_CONFLICT',
      }),
    );
    await expect(updateWorkOrder(raw.id, { description: 'X', expectedVersion: 1 })).rejects.toMatchObject({
      status: 409,
      code: 'WORK_ORDER_CONFLICT',
      fieldErrors: { expectedVersion: expect.any(Array) },
    });
  });
});

describe('web work-order API client list', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.NEXT_PUBLIC_API_URL = 'http://api.example.test';
    window.localStorage.clear();
  });

  it('searchWorkOrders GET query + no-store + Bearer; trả { data, total, limit, offset }', async () => {
    fetchMock.mockResolvedValueOnce(
      response(200, { data: [raw], total: 1, limit: 20, offset: 0 }),
    );
    window.localStorage.setItem('buildflow.auth.v1', JSON.stringify({ accessToken: 'jwt-1' }));
    const res = await searchWorkOrders({ projectId: UUID, status: 'DRAFT', search: 'be tong', limit: 20, offset: 0 });
    expect(res.total).toBe(1);
    expect(res.data[0].code).toBe('WO-ABC123');
    const [url, init] = fetchMock.mock.calls[0];
    const parsed = new URL(String(url));
    expect(`${parsed.origin}${parsed.pathname}`).toBe('http://api.example.test/api/v1/work-orders');
    expect(parsed.searchParams.get('projectId')).toBe(UUID);
    expect(parsed.searchParams.get('status')).toBe('DRAFT');
    expect(parsed.searchParams.get('search')).toBe('be tong');
    expect(parsed.searchParams.get('limit')).toBe('20');
    expect(parsed.searchParams.get('offset')).toBe('0');
    expect((init as RequestInit).cache).toBe('no-store');
    expect((init as RequestInit).headers).toEqual(expect.objectContaining({ Authorization: 'Bearer jwt-1' }));
  });

  it('status ALL không gửi param status; không params → URL trần', async () => {
    fetchMock.mockResolvedValueOnce(response(200, { data: [], total: 0, limit: 20, offset: 0 }));
    await searchWorkOrders({ status: 'ALL' });
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://api.example.test/api/v1/work-orders');
  });

  it('403 projectId ngoài scope + 401 hết phiên giữ message', async () => {
    fetchMock.mockResolvedValueOnce(response(403, { message: 'Không có quyền truy cập dự án này' }));
    await expect(searchWorkOrders({ projectId: UUID })).rejects.toMatchObject({ status: 403 });

    fetchMock.mockResolvedValueOnce(response(401, { message: 'Phiên hết hạn, vui lòng đăng nhập lại' }));
    await expect(searchWorkOrders()).rejects.toMatchObject({ status: 401 });
  });
});
