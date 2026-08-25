import { LoginForm } from '@/features/auth';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sign in — Buildflow',
};

export default function LoginPage() {
  return (
    <main style={{ maxWidth: 480, margin: '2rem auto', padding: '1rem' }}>
      <h1>Sign in</h1>
      <p style={{ color: '#555' }}>Worker login with email and password. Session uses an opaque bearer token.</p>
      <LoginForm />
    </main>
  );
}
