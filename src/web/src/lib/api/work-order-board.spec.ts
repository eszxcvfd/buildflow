import { closeJobBoard, openJobBoard } from './work-order-board';

function response(status: number, body: unknown, contentType = 'application/json') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    json: jest.fn(async () => body),
    text: jest.fn(async () => (typeof body === 'string' ? body : JSON.stringify(body))),
  } as unknown as Response;
}

const WO_ID = '33333333-3333-4333-8333-333333333333';

const woBase = {
  id: WO_ID,
  code: 'WO-ABC123',
  projectId: '11111111-1111-4111-8111-111111111111',
  areaId: null,
  workTypeId: '22222222-2222-4222-8222-222222222222',
  requiredTradeId: null,
  title: 'Do be tong cot C1',
  description: null,
  instructions: null,
  priority: 'NORMAL',
  status: 'OPEN',
  plannedStartAt: '2026-10-06T01:00:00.000Z',
  plannedEndAt: '2026-10-10T10:00:00.000Z',
  dueAt: null,
  plannedHeadcount: null,
  createdBy: 'u-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  version: 2,
  jobBoard: {
    open: true,
    openFrom: '2026-10-06T01:00:00.000Z',
    openUntil: null,
    hasActiveAssignment: false,
    state: 'AVAILABLE',
  },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('web job-board API client JOB-SRS-004', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.NEXT_PUBLIC_API_URL = 'http://api.example.test';
    window.localStorage.clear();
  });

  it('openJobBoard POST đúng URL + Bearer + X-Correlation-Id; 200 → alreadyOpen false', async () => {
    fetchMock.mockResolvedValueOnce(response(200, woBase));
    window.localStorage.setItem('buildflow.auth.v1', JSON.stringify({ accessToken: 'jwt-1' }));
    const res = await openJobBoard(
      WO_ID,
      { jobBoardOpenFrom: '2026-10-06T01:00:00.000Z', jobBoardOpenUntil: null },
      { correlationId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' },
    );
    expect(res.workOrder.jobBoard?.state).toBe('AVAILABLE');
    expect(res.alreadyOpen).toBe(false);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`http://api.example.test/api/v1/work-orders/${WO_ID}/job-board/open`);
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer jwt-1');
    expect(headers['X-Correlation-Id']).toBe('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({
      jobBoardOpenFrom: '2026-10-06T01:00:00.000Z',
      jobBoardOpenUntil: null,
    });
  });

  it('openJobBoard tự sinh X-Correlation-Id dạng UUID khi không override', async () => {
    fetchMock.mockResolvedValueOnce(response(200, woBase));
    await openJobBoard(WO_ID, { jobBoardOpenFrom: '2026-10-06T01:00:00.000Z' });
    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['X-Correlation-Id']).toMatch(UUID_RE);
  });

  it('openJobBoard replay cùng window → alreadyOpen true', async () => {
    fetchMock.mockResolvedValueOnce(response(200, { ...woBase, alreadyOpen: true }));
    const res = await openJobBoard(WO_ID, { jobBoardOpenFrom: '2026-10-06T01:00:00.000Z' });
    expect(res.alreadyOpen).toBe(true);
  });

  it('openJobBoard 400 giữ nguyên fieldErrors từng input', async () => {
    fetchMock.mockResolvedValueOnce(
      response(400, {
        message: 'Cửa sổ Job Board không hợp lệ',
        code: 'JOB_BOARD_WINDOW_INVALID',
        fieldErrors: { jobBoardOpenUntil: ['Thời điểm kết thúc phải sau thời điểm bắt đầu'] },
      }),
    );
    await expect(openJobBoard(WO_ID, { jobBoardOpenUntil: '2020-01-01T00:00:00.000Z' })).rejects.toMatchObject({
      status: 400,
      code: 'JOB_BOARD_WINDOW_INVALID',
      fieldErrors: { jobBoardOpenUntil: ['Thời điểm kết thúc phải sau thời điểm bắt đầu'] },
    });
  });

  it('openJobBoard 409 conflict giữ code để UI hiện nút Tải lại', async () => {
    fetchMock.mockResolvedValueOnce(
      response(409, { message: 'Work order đã bị thay đổi', code: 'WORK_ORDER_CONFLICT' }),
    );
    await expect(openJobBoard(WO_ID, {})).rejects.toMatchObject({
      status: 409,
      code: 'WORK_ORDER_CONFLICT',
    });
  });

  it('closeJobBoard POST đúng URL; alreadyClosed true khi đã đóng', async () => {
    fetchMock.mockResolvedValueOnce(
      response(200, {
        ...woBase,
        status: 'READY',
        version: 3,
        jobBoard: { open: false, openFrom: '2026-10-06T01:00:00.000Z', openUntil: null, hasActiveAssignment: false, state: 'CLOSED' },
        alreadyClosed: true,
      }),
    );
    window.localStorage.setItem('buildflow.auth.v1', JSON.stringify({ accessToken: 'jwt-1' }));
    const res = await closeJobBoard(WO_ID, {}, { correlationId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb' });
    expect(res.alreadyClosed).toBe(true);
    expect(res.workOrder.jobBoard?.state).toBe('CLOSED');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`http://api.example.test/api/v1/work-orders/${WO_ID}/job-board/close`);
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['X-Correlation-Id']).toBe('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb');
  });

  it('F010: fetch reject (lỗi mạng) → ApiError status 0 để UI hiện Alert', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(openJobBoard(WO_ID, {})).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining('Không thể kết nối'),
    });
  });

  it('F010: 2xx body parse không ra JSON → ApiError fallback, không SyntaxError thô', async () => {
    const bad = response(200, woBase);
    (bad.json as jest.Mock).mockRejectedValueOnce(new SyntaxError('Unexpected token'));
    fetchMock.mockResolvedValueOnce(bad);
    await expect(openJobBoard(WO_ID, {})).rejects.toMatchObject({ status: 200 });
  });

  it('F010: lỗi non-JSON (text) → message giữ nguyên body', async () => {
    fetchMock.mockResolvedValueOnce(response(502, 'Bad Gateway', 'text/plain'));
    await expect(closeJobBoard(WO_ID, {})).rejects.toMatchObject({ status: 502, message: 'Bad Gateway' });
  });

  it('F026: stock-Nest 400 `{ message: string[] }` → ApiError giữ đủ message + fieldErrors (không mất)', async () => {
    fetchMock.mockResolvedValueOnce(response(400, { message: ['jobBoardOpenFrom must be ISO', 'extra not allowed'], statusCode: 400 }));
    await expect(openJobBoard(WO_ID, {})).rejects.toMatchObject({
      status: 400,
      fieldErrors: { _global: expect.arrayContaining(['jobBoardOpenFrom must be ISO']) },
    });
  });

  it('closeJobBoard không gửi token khi chưa đăng nhập (server trả 401)', async () => {
    fetchMock.mockResolvedValueOnce(response(401, { message: 'Unauthorized' }));
    await expect(closeJobBoard(WO_ID, {})).rejects.toMatchObject({ status: 401 });
    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});
