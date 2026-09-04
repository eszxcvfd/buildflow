import { getUserRoles, assignRoles, type GetUserRolesResult } from '@/lib/api/admin-roles';

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

const rolesResult: GetUserRolesResult = {
  userId: 'u-1',
  roles: [{ id: 'r1', code: 'WORKER', name: 'Worker' }],
  effectivePolicy: 'PERMISSION_EFFECTIVE_NEXT_LOGIN',
};

describe('admin-roles API client (IAM-SRS-005)', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
    localStorage.setItem(
      'buildflow.auth.v1',
      JSON.stringify({ accessToken: 'tok123', expiresAt: new Date(Date.now() + 3600000).toISOString() }),
    );
  });

  it('getUserRoles sends Bearer token to roles endpoint', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(mockJsonResponse(200, rolesResult));
    setFetchMock(fetchMock);
    const res = await getUserRoles('u-1');
    expect(res.roles).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/admin/users/u-1/roles'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok123' }),
      }),
    );
  });

  it('assignRoles PUTs roleIds and returns before/after', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      mockJsonResponse(200, { ...rolesResult, beforeRoleIds: ['r1'], afterRoleIds: ['r1', 'r2'] }),
    );
    setFetchMock(fetchMock);
    const res = await assignRoles('u-1', { roleIds: ['r1', 'r2'] });
    expect(res.afterRoleIds).toEqual(['r1', 'r2']);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/admin/users/u-1/roles');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body)).toEqual({ roleIds: ['r1', 'r2'] });
  });

  it('maps 403 forbidden with Vietnamese message', async () => {
    setFetchMock(jest.fn().mockResolvedValueOnce(mockJsonResponse(403, { message: 'Không có quyền truy cập' })));
    await expect(assignRoles('u-1', { roleIds: ['r1'] })).rejects.toMatchObject({
      status: 403,
      message: 'Không có quyền truy cập',
    });
  });

  it('maps 400 role-not-found message', async () => {
    setFetchMock(jest.fn().mockResolvedValueOnce(
      mockJsonResponse(400, { message: 'Role không tồn tại hoặc đã ngừng hoạt động: bad-id' }),
    ));
    await expect(assignRoles('u-1', { roleIds: ['bad-id'] })).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('Role không tồn tại'),
    });
  });
});
