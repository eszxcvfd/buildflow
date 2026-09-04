import { fetchProfile, updateProfile, type Profile } from './profile';

const sample: Profile = {
  id: 'u1', email: 'e2e@example.com', fullName: 'E2E User', phone: '0901234567',
  avatarUrl: null, employeeCode: null, userType: 'STAFF', contractorId: null,
  status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};

const okResponse = (body: unknown, status: number) => ({
  ok: status < 400, status,
  json: async () => body,
});

describe('fetchProfile', () => {
  afterEach(() => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = globalThis.fetch;
  });

  it('returns profile on 200 with Bearer header', async () => {
    const mock = jest.fn(async (url: string, init?: { headers?: Record<string, string> }) => {
      expect(url).toContain('/api/v1/me/profile');
      expect(init?.headers?.Authorization).toBe('Bearer tok-1');
      return okResponse(sample, 200);
    });
    // eslint-disable-next-line no-native-reassign
    global.fetch = mock as unknown as typeof fetch;
    await expect(fetchProfile('tok-1')).resolves.toMatchObject({ fullName: 'E2E User' });
  });

  it('throws ProfileError on 401', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () => okResponse({}, 401)) as unknown as typeof fetch;
    await expect(fetchProfile('tok-1')).rejects.toMatchObject({ status: 401 });
  });
});

describe('updateProfile', () => {
  afterEach(() => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = globalThis.fetch;
  });

  it('sends PATCH with JSON body and returns updated profile on 200', async () => {
    const mock = jest.fn(async (url: string, init?: { method?: string; body?: string }) => {
      expect(init?.method).toBe('PATCH');
      expect(String(init?.body)).toContain('E2E Renamed');
      return okResponse({ ...sample, fullName: 'E2E Renamed' }, 200);
    });
    // eslint-disable-next-line no-native-reassign
    global.fetch = mock as unknown as typeof fetch;
    const result = await updateProfile('tok-1', { fullName: 'E2E Renamed' });
    expect(result.fullName).toBe('E2E Renamed');
  });

  it('maps 400 validation array to per-field errors', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () =>
      okResponse({ message: ['Họ tên không được để trống', 'Số điện thoại không hợp lệ'], statusCode: 400 }, 400),
    ) as unknown as typeof fetch;
    await expect(updateProfile('tok-1', { fullName: '', phone: 'x' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: {
        fullName: ['Họ tên không được để trống'],
        phone: ['Số điện thoại không hợp lệ'],
      },
    });
  });

  it('maps 401 to ProfileError without fieldErrors', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () => okResponse({ message: 'Phiên hết hạn' }, 401)) as unknown as typeof fetch;
    await expect(updateProfile('tok-1', {})).rejects.toMatchObject({ status: 401, fieldErrors: undefined });
  });
});
