import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { CrewList } from '@/features/crews';

export const dynamic = 'force-dynamic';

export default function CrewsPage() {
  return (
    <>
      <PageHeader
        title="Đội thi công"
        subtitle="Danh sách đội thi công — tạo đội, chỉ định trưởng nhóm và cập nhật trạng thái. Đội ngừng hoạt động không nhận phân công mới."
        actions={
          <a className="bf-btn bf-btn-primary" href="/crews/new">
            Thêm đội thi công
          </a>
        }
      />
      <CrewList />
    </>
  );
}
