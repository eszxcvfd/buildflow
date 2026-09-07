import { ProjectDetail } from '@/features/projects';

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  return <ProjectDetail id={params.id} />;
}
