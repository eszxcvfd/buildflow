import { listProjects, getProject, type Project } from '@/lib/api/projects';

function mockJsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

const sample: Project = {
  id: 'p1',
  code: 'PRA',
  name: 'Du an A',
  status: 'ACTIVE',
  managerId: 'm1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('projects API client (IAM-SRS-006)', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
    localStorage.setItem(
      'buildflow.auth.v1',
      JSON.stringify({ accessToken: 'tok123', expiresAt: new Date(Date.now() + 3600000).toISOString() }),
    );
  });

  it('listProjects sends Bearer and returns array', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(mockJsonResponse(200, [sample]));
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
    const res = await listProjects();
    expect(res).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/projects'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok123' }) }),
    );
  });

  it('getProject hits :id endpoint', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(mockJsonResponse(200, sample));
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
    const res = await getProject('p1');
    expect(res.code).toBe('PRA');
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/projects/p1');
  });

  it('maps 403 forbidden message', async () => {
    (global as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValueOnce(
      mockJsonResponse(403, { message: 'Không có quyền truy cập dự án này' }),
    );
    await expect(getProject('p-out')).rejects.toMatchObject({
      status: 403,
      message: 'Không có quyền truy cập dự án này',
    });
  });

  it('maps 401 session expired', async () => {
    (global as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValueOnce(
      mockJsonResponse(401, { message: 'Phiên hết hạn, vui lòng đăng nhập lại' }),
    );
    await expect(listProjects()).rejects.toMatchObject({ status: 401 });
  });
});
