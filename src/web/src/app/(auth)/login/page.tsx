import { LoginForm } from '@/features/auth';

export const metadata = { title: 'Đăng nhập — Buildflow' };

export default function LoginPage() {
  return (
    <>
      <LoginForm />
      <p className="bf-auth-foot" style={{ margin: 0 }}>
        <a href="/forgot-password">Quên mật khẩu?</a>
      </p>
    </>
  );
}
