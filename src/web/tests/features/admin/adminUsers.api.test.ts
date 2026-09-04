import {
  listAdminUsers,
  createAdminUser,
  updateAdminUserStatus,
  type AdminUser,
} from '@/lib/api/admin-users';

const sampleUser: AdminUser = {
  id: 'u-1',
  email: 'a@b.com',
  fullName: 'Nguyen Van A',
  phone: null,
  avatarUrl: null,
  employeeCode: null,
  userType: 'STAFF',
  contractorId: null,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
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

describe('admin-users API client (IAM-SRS-004)', () => {
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

  it('listAdminUsers sends Bearer token and returns data', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(mockJsonResponse(200, { data: [sampleUser] }));
    setFetchMock(fetchMock);
    const res = await listAdminUsers({ status: 'ACTIVE' });
    expect(res.data).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/admin/users?status=ACTIVE'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok123' }),
      }),
    );
  });

  it('createAdminUser posts JSON payload with auth header', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(mockJsonResponse(201, sampleUser));
    setFetchMock(fetchMock);
    const created = await createAdminUser({
      email: 'a@b.com',
      password: 'Password123',
      fullName: 'Nguyen Van A',
    });
    expect(created.id).toBe('u-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/admin/users');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['Content-Type']).toContain('application/json');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok123');
  });

  it('createAdminUser maps 409 duplicate email with Vietnamese message', async () => {
    setFetchMock(jest.fn().mockResolvedValueOnce(mockJsonResponse(409, { message: 'Email đã tồn tại' })));
    await expect(
      createAdminUser({ email: 'dup@b.com', password: 'Password123', fullName: 'Dup' }),
    ).rejects.toMatchObject({ status: 409, message: 'Email đã tồn tại' });
  });

  it('updateAdminUserStatus PATCHes status endpoint', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(mockJsonResponse(200, { ...sampleUser, status: 'LOCKED' }));
    setFetchMock(fetchMock);
    const updated = await updateAdminUserStatus('u-1', { status: 'LOCKED' });
    expect(updated.status).toBe('LOCKED');
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/admin/users/u-1/status');
  });

  it('maps array validation messages into fieldErrors', async () => {
    setFetchMock(jest.fn().mockResolvedValueOnce(mockJsonResponse(400, { message: ['Email không hợp lệ', 'Mật khẩu tối thiểu 8 ký tự'] })));
    await expect(
      createAdminUser({ email: 'bad', password: 'short', fullName: 'X' }),
    ).rejects.toMatchObject({
      status: 400,
      fieldErrors: {
        email: ['Email không hợp lệ'],
        password: ['Mật khẩu tối thiểu 8 ký tự'],
      },
    });
  });
});
