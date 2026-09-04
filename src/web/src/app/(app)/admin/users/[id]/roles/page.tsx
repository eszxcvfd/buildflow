import { AdminUserRoleAssign } from '@/features/admin';

export const dynamic = 'force-dynamic';

export default async function AdminUserRolesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main style={{ padding: '2rem', maxWidth: 720, margin: '0 auto', display: 'grid', gap: '1rem' }}>
      <header>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Gán vai trò</h1>
        <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>IAM-SRS-005 · Issue #20 · Chỉ role đã phê duyệt được gán. Quyền mới hiệu lực từ lần truy cập tiếp theo.</p>
      </header>
      <AdminUserRoleAssign userId={id} />
    </main>
  );
}
