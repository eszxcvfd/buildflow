import { LoginForm } from '@/features/auth';

export const metadata = { title: 'Đăng nhập — Buildflow' };

export default function LoginPage() {
  return (
    <main style={{ minHeight: '80vh', display: 'grid', placeItems: 'center', padding: '2rem 1rem', background: '#f9fafb' }}>
      <LoginForm />
    </main>
  );
}
