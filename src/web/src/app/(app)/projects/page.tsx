import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { ProjectsHeaderActions, ProjectsList } from '@/features/projects';

export const dynamic = 'force-dynamic';

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        title="Dự án"
        subtitle="Các dự án bạn là thành viên — server lọc theo quyền"
        actions={<ProjectsHeaderActions />}
      />
      <ProjectsList />
    </>
  );
}
