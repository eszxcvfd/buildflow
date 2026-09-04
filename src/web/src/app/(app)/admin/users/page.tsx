import { AdminUserList } from '@/features/admin';

export const dynamic = 'force-dynamic';

export default function AdminUsersPage() {
  return (
    <main style={{ padding: '2rem', maxWidth: 1080, margin: '0 auto', display: 'grid', gap: '1rem' }}>
      <header>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Quản lý tài khoản</h1>
        <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>IAM-SRS-004 · Issue #19 · Admin tạo, cập nhật, khóa/mở khóa, ngừng hoạt động tài khoản. Không xóa cứng tài khoản có lịch sử.</p>
      </header>
      <AdminUserList />
    </main>
  );
}
