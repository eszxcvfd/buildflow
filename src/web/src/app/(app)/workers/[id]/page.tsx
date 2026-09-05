import { WorkerDetail } from '@/features/workers';

export const dynamic = 'force-dynamic';

export default async function WorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkerDetail id={id} />;
}
