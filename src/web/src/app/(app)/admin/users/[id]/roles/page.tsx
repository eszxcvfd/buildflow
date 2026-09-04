import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { AdminUserRoleAssign } from '@/features/admin';

export const dynamic = 'force-dynamic';

export default async function AdminUserRolesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <PageHeader
        title="Gán vai trò"
        subtitle="Chỉ vai trò đã phê duyệt được gán cho tài khoản. Quyền mới có hiệu lực từ lần truy cập tiếp theo."
      />
      <AdminUserRoleAssign userId={id} />
    </>
  );
}
