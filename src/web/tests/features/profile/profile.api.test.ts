/**
 * Integration-style unit tests cho lib/api/profile.ts (IAM-SRS-003)
 * Contract: GET/PATCH /api/v1/me/profile, allow-list {fullName, phone, avatarUrl}
 * Error mapping: 200 success, 400 fieldErrors, 401 generic message
 */
import { fetchProfile, updateProfile, type Profile } from '@/lib/api/profile';

function mockJsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

const sampleProfile: Profile = {
  id: 'u1',
  email: 'a@b.com',
  fullName: 'Nguyen Van A',
  phone: '0901234567',
  avatarUrl: null,
  employeeCode: 'EMP-1',
  userType: 'STAFF',
  contractorId: null,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('GET /api/v1/me/profile (fetchProfile)', () => {
  const origPublic = process.env.NEXT_PUBLIC_API_URL;
  beforeEach(() => jest.restoreAllMocks());
  afterAll(() => {
    if (origPublic === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = origPublic;
  });

  it('success: GET với Bearer token, Accept JSON, cache no-store và trả về Profile', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
    const fetchMock = jest.fn().mockResolvedValueOnce(mockJsonResponse(200, sampleProfile));
    (global as unknown as { fetch: unknown }).fetch = fetchMock;

    const p = await fetchProfile('tok123');
    expect(p).toEqual(sampleProfile);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/me/profile',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok123', Accept: 'application/json' }),
        cache: 'no-store',
      }),
    );
  });

  it('401: throws ProfileError với message tiếng Việt', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
    (global as unknown as { fetch: unknown }).fetch = jest
      .fn()
      .mockResolvedValueOnce(mockJsonResponse(401, { message: 'Phiên hết hạn', statusCode: 401 }));
    await expect(fetchProfile('expired')).rejects.toMatchObject({ status: 401, message: expect.stringContaining('401') });
  });
});

describe('PATCH /api/v1/me/profile (updateProfile)', () => {
  const origPublic = process.env.NEXT_PUBLIC_API_URL;
  beforeEach(() => jest.restoreAllMocks());
  afterAll(() => {
    if (origPublic === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = origPublic;
  });

  it('success: PATCH đúng method, Content-Type UTF-8, Bearer token, body allow-list', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
    const payload = { fullName: 'New Name', phone: null, avatarUrl: null };
    const fetchMock = jest.fn().mockResolvedValueOnce(mockJsonResponse(200, { ...sampleProfile, fullName: 'New Name' }));
    (global as unknown as { fetch: unknown }).fetch = fetchMock;

    const p = await updateProfile('tok123', payload);
    expect(p.fullName).toBe('New Name');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/me/profile',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: 'Bearer tok123',
        }),
        body: JSON.stringify(payload),
      }),
    );
  });

  it('400: message array ánh xạ sang fieldErrors theo trường', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
    (global as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValueOnce(
      mockJsonResponse(400, {
        message: ['fullName should not be empty', 'phone must be a valid phone number'],
        error: 'Bad Request',
        statusCode: 400,
      }),
    );
    await expect(updateProfile('tok123', { fullName: '' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: expect.objectContaining({
        fullName: expect.any(Array),
        phone: expect.any(Array),
      }),
    });
  });

  it('400: message string trả về message gốc, không có fieldErrors', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
    (global as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValueOnce(
      mockJsonResponse(400, { message: 'Dữ liệu không hợp lệ', statusCode: 400 }),
    );
    await expect(updateProfile('tok123', { fullName: 'x' })).rejects.toMatchObject({
      status: 400,
      message: 'Dữ liệu không hợp lệ',
      fieldErrors: undefined,
    });
  });

  it('401: throws ProfileError 401', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
    (global as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValueOnce(
      mockJsonResponse(401, { message: 'Phiên hết hạn', statusCode: 401 }),
    );
    await expect(updateProfile('expired', { fullName: 'x' })).rejects.toMatchObject({ status: 401 });
  });
});
