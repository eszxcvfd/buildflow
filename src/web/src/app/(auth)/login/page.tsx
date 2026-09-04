import { LoginForm } from '@/features/auth';

export const metadata = { title: 'Đăng nhập — Buildflow' };

export default function LoginPage() {
  return (
    <main style={{ minHeight: '80vh', display: 'grid', placeItems: 'center', padding: '2rem 1rem', background: '#f9fafb' }}>
      <div style={{ display: 'grid', gap: '0.75rem', justifyItems: 'center' }}>
        <LoginForm />
        <a href="/forgot-password" style={{ color: '#1d4ed8', textDecoration: 'underline', fontSize: '0.9rem' }}>Quên mật khẩu?</a>
      </div>
    </main>
  );
}
