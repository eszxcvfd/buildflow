import { ContractorDetail } from '@/features/contractors';

export default function ContractorDetailPage({ params }: { params: { id: string } }) {
  return <ContractorDetail id={params.id} />;
}
