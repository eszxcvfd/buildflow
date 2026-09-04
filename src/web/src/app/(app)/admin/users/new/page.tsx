import { AdminUserCreateForm } from '@/features/admin';

export const dynamic = 'force-dynamic';

export default function AdminUserNewPage() {
  return (
    <main style={{ padding: '2rem', maxWidth: 720, margin: '0 auto', display: 'grid', gap: '1rem' }}>
      <header>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Tạo tài khoản mới</h1>
        <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>IAM-SRS-004 · Email phải duy nhất trong toàn hệ thống.</p>
      </header>
      <AdminUserCreateForm />
    </main>
  );
}
