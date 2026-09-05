import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { WorkerForm } from '@/features/workers';

export default function WorkerNewPage() {
  return (
    <>
      <PageHeader
        title="Thêm công nhân"
        subtitle="Nhập định danh duy nhất, thông tin liên hệ, ngành nghề và kỹ năng. Hồ sơ mới mặc định ACTIVE."
      />
      <WorkerForm mode="create" />
    </>
  );
}
