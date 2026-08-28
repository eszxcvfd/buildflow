import { validateLogin } from './login.schema';

describe('validateLogin IAM-SRS-001', () => {
  it('accepts a valid email and password', () => {
    expect(validateLogin({ email: 'alice@example.com', password: 'Secret123!' })).toEqual({
      valid: true,
      fieldErrors: {},
    });
  });

  it('reports required and format errors without calling the API', () => {
    expect(validateLogin({ email: 'not-an-email', password: '' })).toEqual({
      valid: false,
      fieldErrors: {
        email: ['Email không hợp lệ'],
        password: ['Mật khẩu không được để trống'],
      },
    });
  });

  it('trims email for validation and enforces contract limits', () => {
    const longEmail = `${'a'.repeat(246)}@example.com`;
    expect(validateLogin({ email: ` ${longEmail} `, password: 'x'.repeat(129) })).toEqual({
      valid: false,
      fieldErrors: {
        email: ['Email tối đa 255 ký tự'],
        password: ['Mật khẩu tối đa 128 ký tự'],
      },
    });
  });
});
