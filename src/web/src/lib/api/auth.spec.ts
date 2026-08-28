import { loginRequest, logoutRequest } from './auth';

function response(status: number, body: unknown, contentType = 'application/json') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => name === 'content-type' ? contentType : null },
    json: jest.fn(async () => body),
    text: jest.fn(async () => String(body)),
  } as unknown as Response;
}

describe('web auth API contract IAM-SRS-001/002', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.NEXT_PUBLIC_API_URL = 'http://api.example.test';
  });

  it('posts login JSON and normalizes generic 401 without account enumeration', async () => {
    fetchMock.mockResolvedValue(response(401, { message: 'Thông tin đăng nhập không hợp lệ' }));
    await expect(loginRequest({ email: 'alice@example.com', password: 'bad' })).rejects.toMatchObject({
      status: 401,
      message: 'Thông tin đăng nhập không hợp lệ',
    });
    expect(fetchMock).toHaveBeenCalledWith('http://api.example.test/api/v1/auth/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'alice@example.com', password: 'bad' }),
    }));
  });

  it.each([
    [403, 'Tài khoản đang bị khóa'],
    [403, 'Tài khoản đã ngừng hoạt động'],
  ])('preserves account state error %s', async (status, message) => {
    fetchMock.mockResolvedValue(response(status, { message }));
    await expect(loginRequest({ email: 'alice@example.com', password: 'Secret123!' })).rejects.toMatchObject({ status, message });
  });

  it('maps validation arrays to field errors', async () => {
    fetchMock.mockResolvedValue(response(400, { message: ['Email không hợp lệ', 'Mật khẩu không được để trống'] }));
    await expect(loginRequest({ email: 'x', password: '' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { email: ['Email không hợp lệ'], password: ['Mật khẩu không được để trống'] },
    });
  });

  it('sends logout bearer token and maps expired session to 401', async () => {
    fetchMock.mockResolvedValue(response(401, { message: 'Phiên hết hạn, vui lòng đăng nhập lại' }));
    await expect(logoutRequest('jwt-1')).rejects.toMatchObject({
      status: 401,
      message: 'Phiên hết hạn, vui lòng đăng nhập lại',
    });
    expect(fetchMock).toHaveBeenCalledWith('http://api.example.test/api/v1/auth/logout', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer jwt-1' }),
    }));
  });
});
