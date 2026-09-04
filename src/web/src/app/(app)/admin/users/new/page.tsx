import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { AdminUserCreateForm } from '@/features/admin';

export const dynamic = 'force-dynamic';

export default function AdminUserNewPage() {
  return (
    <>
      <PageHeader
        title="Thêm tài khoản"
        subtitle="Tạo tài khoản cho nhân viên hoặc công nhân. Email phải duy nhất trong toàn hệ thống."
      />
      <AdminUserCreateForm />
    </>
  );
}
