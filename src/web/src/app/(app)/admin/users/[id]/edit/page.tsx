import { AdminUserEditForm } from '@/features/admin';

export const dynamic = 'force-dynamic';

export default async function AdminUserEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main style={{ padding: '2rem', maxWidth: 720, margin: '0 auto', display: 'grid', gap: '1rem' }}>
      <header>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Cập nhật tài khoản</h1>
        <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>IAM-SRS-004 · Thay đổi thông tin hồ sơ. Trạng thái (khóa/mở khóa/ngừng hoạt động) quản lý từ danh sách.</p>
      </header>
      <AdminUserEditForm userId={id} />
    </main>
  );
}
