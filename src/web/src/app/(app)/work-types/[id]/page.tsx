import { WorkTypeDetail } from '@/features/work-types';

export default function WorkTypeDetailPage({ params }: { params: { id: string } }) {
  return <WorkTypeDetail id={params.id} />;
}
