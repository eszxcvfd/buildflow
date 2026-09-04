import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { AdminUserList } from '@/features/admin';

export const dynamic = 'force-dynamic';

export default function AdminUsersPage() {
  return (
    <>
      <PageHeader
        title="Tài khoản"
        subtitle="Quản lý tài khoản hệ thống — tạo mới, khóa/mở khóa, ngừng hoạt động và gán vai trò."
        actions={
          <a className="bf-btn bf-btn-primary" href="/admin/users/new">
            Thêm tài khoản
          </a>
        }
      />
      <AdminUserList />
    </>
  );
}
