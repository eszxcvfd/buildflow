import { CrewDetail } from '@/features/crews';

export default function CrewDetailPage({ params }: { params: { id: string } }) {
  return <CrewDetail id={params.id} />;
}
