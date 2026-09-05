/**
 * Tests cho audit-logs API client (IAM-SRS-008, GitHub issue #23).
 * GET /api/v1/audit-logs (admin-only): chỉ serialize filter có giá trị,
 * Bearer + Accept headers, parse {data,total,limit,offset} khoan dung,
 * 401/403/400 mapping sang AuditLogError (kèm fieldErrors theo keyword).
 */
import { listAuditLogs, type AuditLog } from '@/lib/api/audit-logs';

const sampleLog: AuditLog = {
  id: 'log-1',
  actorUserId: 'u-1',
  action: 'AUTH_LOGIN_SUCCESS',
  entityType: 'User',
  entityId: 'u-1',
  beforeData: null,
  afterData: null,
  reason: null,
  result: 'SUCCESS',
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
  correlationId: '11111111-2222-4333-8444-555555555555',
  createdAt: '2026-01-01T00:00:00.000Z',
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

describe('audit-logs API client (IAM-SRS-008)', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
      'buildflow.auth.v1',
      JSON.stringify({ accessToken: 'tok123', expiresAt: new Date(Date.now() + 3600000).toISOString() }),
    );
  });

  it('listAuditLogs gửi Bearer + Accept, cache no-store và chỉ serialize filter được cung cấp', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      mockJsonResponse(200, { data: [sampleLog], total: 1, limit: 20, offset: 40 }),
    );
    setFetchMock(fetchMock);
    const res = await listAuditLogs({ action: 'AUTH_LOGIN_FAILED', limit: 20, offset: 40 });

    expect(res).toEqual({ data: [sampleLog], total: 1, limit: 20, offset: 40 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/v1/audit-logs?');
    const qs = new URLSearchParams(String(url).split('?')[1]);
    expect([...qs.keys()].sort()).toEqual(['action', 'limit', 'offset']);
    expect(qs.get('action')).toBe('AUTH_LOGIN_FAILED');
    expect(qs.get('limit')).toBe('20');
    expect(qs.get('offset')).toBe('40');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok123');
    expect((init?.headers as Record<string, string>).Accept).toBe('application/json');
    expect(init?.cache).toBe('no-store');
  });

  it('filter actorUserId serialize ?actorUserId=u-9 và không còn key actor (Finding 2)', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      mockJsonResponse(200, { data: [], total: 0, limit: 20, offset: 0 }),
    );
    setFetchMock(fetchMock);
    await listAuditLogs({ actorUserId: 'u-9' });

    const url = String(fetchMock.mock.calls[0][0]);
    const qs = new URLSearchParams(url.split('?')[1]);
    expect(qs.get('actorUserId')).toBe('u-9');
    expect(qs.has('actor')).toBe(false);
    expect([...qs.keys()].sort()).toEqual(['actorUserId']);
  });

  it('date-only from/to gửi nguyên dạng YYYY-MM-DD, không tự gắn thời gian (Finding 3b)', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      mockJsonResponse(200, { data: [], total: 0, limit: 20, offset: 0 }),
    );
    setFetchMock(fetchMock);
    await listAuditLogs({ from: '2026-08-01', to: '2026-08-31' });

    const url = String(fetchMock.mock.calls[0][0]);
    const qs = new URLSearchParams(url.split('?')[1]);
    expect([...qs.keys()].sort()).toEqual(['from', 'to']);
    expect(qs.get('from')).toBe('2026-08-01');
    expect(qs.get('to')).toBe('2026-08-31');
  });

  it('parse {data,total,limit,offset} với coercion số khi server trả string', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      mockJsonResponse(200, { data: [sampleLog], total: '45', limit: '20', offset: '20' }),
    );
    setFetchMock(fetchMock);
    const res = await listAuditLogs({});
    expect(res.data).toHaveLength(1);
    expect(res.total).toBe(45);
    expect(res.limit).toBe(20);
    expect(res.offset).toBe(20);
  });

  it('tolerant parse: bare array body → total = data.length, limit/offset từ filters', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(mockJsonResponse(200, [sampleLog, { ...sampleLog, id: 'log-2' }]));
    setFetchMock(fetchMock);
    const res = await listAuditLogs({ limit: 5, offset: 2 });
    expect(res.data).toHaveLength(2);
    expect(res.total).toBe(2);
    expect(res.limit).toBe(5);
    expect(res.offset).toBe(2);
  });

  it('body không parse được → trang rỗng với fallback limit/offset', async () => {
    setFetchMock(jest.fn().mockResolvedValueOnce(mockJsonResponse(200, {})));
    const res = await listAuditLogs({ limit: 10, offset: 30 });
    expect(res).toEqual({ data: [], total: 0, limit: 10, offset: 30 });
  });

  it('401 → throw {status:401} với fallback message tiếng Việt', async () => {
    setFetchMock(jest.fn().mockResolvedValueOnce(mockJsonResponse(401, null)));
    await expect(listAuditLogs()).rejects.toMatchObject({
      status: 401,
      message: 'Tải nhật ký thao tác thất bại (401)',
    });
  });

  it('403 → throw {status:403} và surface JSON error message', async () => {
    setFetchMock(jest.fn().mockResolvedValueOnce(mockJsonResponse(403, { message: 'Yêu cầu vai trò ADMIN' })));
    await expect(listAuditLogs()).rejects.toMatchObject({
      status: 403,
      message: 'Yêu cầu vai trò ADMIN',
    });
  });

  it('400 array message → fieldErrors map theo keyword (limit, action)', async () => {
    setFetchMock(
      jest.fn().mockResolvedValueOnce(
        mockJsonResponse(400, {
          message: ['limit must not be greater than 100', 'action không nằm trong danh sách cho phép'],
        }),
      ),
    );
    await expect(listAuditLogs({ limit: 500 })).rejects.toMatchObject({
      status: 400,
      fieldErrors: {
        limit: ['limit must not be greater than 100'],
        action: ['action không nằm trong danh sách cho phép'],
      },
    });
  });

  it('400 message đơn → throw thẳng message', async () => {
    setFetchMock(jest.fn().mockResolvedValueOnce(mockJsonResponse(400, { message: 'from phải là ngày ISO' })));
    await expect(listAuditLogs({ from: '2026-13-40' })).rejects.toMatchObject({
      status: 400,
      message: 'from phải là ngày ISO',
    });
  });
});
