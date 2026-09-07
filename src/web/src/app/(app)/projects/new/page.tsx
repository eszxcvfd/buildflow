import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { ProjectForm } from '@/features/projects';

export default function ProjectNewPage() {
  return (
    <>
      <PageHeader
        title="Tạo dự án"
        subtitle="Nhập mã, tên, địa chỉ, ngày kế hoạch và chỉ định quản lý dự án. Dự án mới luôn ở trạng thái nháp (DRAFT)."
      />
      <ProjectForm mode="create" />
    </>
  );
}
