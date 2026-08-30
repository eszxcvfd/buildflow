import { ContractorDetail } from '@/features/contractors';

export default function ContractorDetailPage({ params }: { params: { id: string } }) {
  return (
    <main style={{ padding: '2rem', maxWidth: 780, margin: '0 auto' }}>
      <ContractorDetail id={params.id} />
    </main>
  );
}
