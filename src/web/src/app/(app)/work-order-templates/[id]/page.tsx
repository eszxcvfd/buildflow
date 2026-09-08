import { WorkOrderTemplateDetail } from '@/features/work-order-templates';

export default function WorkOrderTemplateDetailPage({ params }: { params: { id: string } }) {
  return <WorkOrderTemplateDetail id={params.id} />;
}
