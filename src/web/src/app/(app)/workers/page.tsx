import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { WorkerList } from '@/features/workers';

export const dynamic = 'force-dynamic';

export default function WorkersPage() {
  return (
    <>
      <PageHeader
        title="Công nhân"
        subtitle="Quản lý hồ sơ công nhân — tạo mới, tìm kiếm, cập nhật và chuyển trạng thái hoạt động."
        actions={
          <a className="bf-btn bf-btn-primary" href="/workers/new">
            Thêm công nhân
          </a>
        }
      />
      <WorkerList />
    </>
  );
}
