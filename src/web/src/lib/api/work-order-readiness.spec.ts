import { getWorkOrderPublishCheck } from './work-order-readiness';

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

function readyBody(overrides = {}) {
  return {
    workOrderId: WO_ID,
    status: 'DRAFT',
    ready: true,
    unmet: [],
    checkedAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('web publish-check API client JOB-SRS-002', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.NEXT_PUBLIC_API_URL = 'http://api.example.test';
    window.localStorage.clear();
  });

  it('GET /:id/publish-check + Bearer + no-store; 200 ready:true', async () => {
    fetchMock.mockResolvedValueOnce(response(200, readyBody()));
    window.localStorage.setItem('buildflow.auth.v1', JSON.stringify({ accessToken: 'jwt-1' }));
    const res = await getWorkOrderPublishCheck(WO_ID);
    expect(res.ready).toBe(true);
    expect(res.unmet).toEqual([]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`http://api.example.test/api/v1/work-orders/${WO_ID}/publish-check`);
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer jwt-1' });
    expect((init as RequestInit).cache).toBe('no-store');
    expect((init as RequestInit).method ?? 'GET').toBe('GET');
  });

  it('200 ready:false giữ nguyên unmet từng mục (code/field/message)', async () => {
    fetchMock.mockResolvedValueOnce(
      response(
        200,
        readyBody({
          ready: false,
          unmet: [
            { code: 'MISSING_SCHEDULE', field: 'plannedStartAt', message: 'Thiếu thời điểm bắt đầu kế hoạch' },
            { code: 'INVALID_STATUS_FOR_PUBLISH', field: 'status', message: 'Chỉ công bố work order ở DRAFT/READY' },
          ],
        }),
      ),
    );
    const res = await getWorkOrderPublishCheck(WO_ID);
    expect(res.ready).toBe(false);
    expect(res.unmet.map((u) => u.code)).toEqual(['MISSING_SCHEDULE', 'INVALID_STATUS_FOR_PUBLISH']);
  });

  it('403 non-member giữ status + message (không leak 404)', async () => {
    fetchMock.mockResolvedValueOnce(response(403, { message: 'Không có quyền truy cập work order' }));
    await expect(getWorkOrderPublishCheck(WO_ID)).rejects.toMatchObject({ status: 403 });
  });

  it('404 ADMIN + id missing giữ status', async () => {
    fetchMock.mockResolvedValueOnce(response(404, { message: 'Không tìm thấy work order' }));
    await expect(getWorkOrderPublishCheck(WO_ID)).rejects.toMatchObject({ status: 404 });
  });

  it('401 anon (không Bearer) giữ status', async () => {
    fetchMock.mockResolvedValueOnce(response(401, { message: 'Unauthorized' }));
    await expect(getWorkOrderPublishCheck(WO_ID)).rejects.toMatchObject({ status: 401 });
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).headers).not.toHaveProperty('Authorization');
  });

  it('400 id sai giữ status + message', async () => {
    fetchMock.mockResolvedValueOnce(response(400, { message: 'Id không hợp lệ' }));
    await expect(getWorkOrderPublishCheck('not-a-uuid')).rejects.toMatchObject({
      status: 400,
      message: 'Id không hợp lệ',
    });
  });
});
