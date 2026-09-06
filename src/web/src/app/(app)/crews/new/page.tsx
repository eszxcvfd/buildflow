import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { CrewForm } from '@/features/crews';

export default function CrewNewPage() {
  return (
    <>
      <PageHeader
        title="Thêm đội thi công"
        subtitle="Nhập mã, tên và chỉ định trưởng nhóm (công nhân đang hoạt động). Đội mới mặc định hoạt động (ACTIVE)."
      />
      <CrewForm mode="create" />
    </>
  );
}
