import { ContractorForm } from '@/features/contractors';

export default function ContractorNewPage() {
  return (
    <main style={{ padding: '2rem', maxWidth: 760, margin: '0 auto' }}>
      <ContractorForm mode="create" />
    </main>
  );
}
