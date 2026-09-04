import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { AdminUserEditForm } from '@/features/admin';

export const dynamic = 'force-dynamic';

export default async function AdminUserEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <PageHeader
        title="Sửa tài khoản"
        subtitle="Cập nhật thông tin hồ sơ. Trạng thái tài khoản (khóa/mở khóa/ngừng hoạt động) quản lý từ danh sách tài khoản."
      />
      <AdminUserEditForm userId={id} />
    </>
  );
}
