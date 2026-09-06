import {
  checkWorkerEligibility,
  checkCrewEligibility,
  checkMyEligibility,
} from './eligibility';

function response(status: number, body: unknown, contentType = 'application/json') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name === 'content-type' ? contentType : null) },
    json: jest.fn(async () => body),
    text: jest.fn(async () => String(body)),
  } as unknown as Response;
}

function workerPayload(overrides = {}) {
  return {
    resourceType: 'WORKER',
    resourceId: 'worker-1',
    eligible: true,
    checkedAt: '2026-02-01T08:00:00.000Z',
    correlationId: 'corr-1',
    conditions: [],
    crews: [],
    ...overrides,
  };
}

describe('web eligibility API client ORG-SRS-008', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.NEXT_PUBLIC_API_URL = 'http://api.example.test';
    window.localStorage.clear();
  });

  it('checkWorkerEligibility builds query + no-store + auth header', async () => {
    fetchMock.mockResolvedValue(response(200, workerPayload()));
    window.localStorage.setItem('buildflow.auth.v1', JSON.stringify({ accessToken: 'jwt-1' }));
    const res = await checkWorkerEligibility('worker-1', {
      tradeId: '33333333-3333-4333-8333-333333333333',
      skillLevel: 3,
      at: '2026-02-01',
    });
    expect(res.correlationId).toBe('corr-1');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/eligibility/workers/worker-1?');
    expect(url).toContain('tradeId=33333333-3333-4333-8333-333333333333');
    expect(url).toContain('skillLevel=3');
    expect(url).toContain('at=2026-02-01');
    expect(init).toEqual(expect.objectContaining({ cache: 'no-store' }));
    expect(init.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer jwt-1' }));
  });

  it('checkCrewEligibility hits crew endpoint', async () => {
    fetchMock.mockResolvedValue(response(200, { ...workerPayload(), resourceType: 'CREW', members: [] }));
    const res = await checkCrewEligibility('crew-1');
    expect(res.resourceType).toBe('CREW');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.example.test/api/v1/eligibility/crews/crew-1');
    expect(init).toEqual(expect.objectContaining({ cache: 'no-store' }));
  });

  it('checkMyEligibility hits /me without id', async () => {
    fetchMock.mockResolvedValue(response(200, workerPayload()));
    await checkMyEligibility();
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.example.test/api/v1/eligibility/me');
  });

  it('404 giữ code RESOURCE_NOT_FOUND cho caller map empty state', async () => {
    fetchMock.mockResolvedValue(
      response(404, { statusCode: 404, message: 'user không có hồ sơ worker', code: 'RESOURCE_NOT_FOUND' }),
    );
    await expect(checkMyEligibility()).rejects.toMatchObject({
      status: 404,
      message: 'user không có hồ sơ worker',
      code: 'RESOURCE_NOT_FOUND',
    });
  });

  it('403 parse message chung', async () => {
    fetchMock.mockResolvedValue(response(403, { statusCode: 403, message: 'Forbidden', code: 'FORBIDDEN' }));
    await expect(checkWorkerEligibility('worker-1')).rejects.toMatchObject({ status: 403 });
  });
});
