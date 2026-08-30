import { ContractorList } from '@/features/contractors';

export const dynamic = 'force-dynamic';

export default function ContractorsPage() {
  return (
    <main style={{ padding: '2rem', maxWidth: 960, margin: '0 auto', display: 'grid', gap: '1rem' }}>
      <header>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Quản lý nhà thầu</h1>
        <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>ORG-SRS-002 · Issue #25 · Admin tạo/sửa, search theo scope/status, INACTIVE chặn phân công mới nhưng lịch sử giữ. UI gọi API thật.</p>
      </header>
      <ContractorList />
    </main>
  );
}
