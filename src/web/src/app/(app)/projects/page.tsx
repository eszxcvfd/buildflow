import { ProjectsList } from '@/features/projects';

export const dynamic = 'force-dynamic';

export default function ProjectsPage() {
  return (
    <main style={{ padding: '2rem', maxWidth: 860, margin: '0 auto', display: 'grid', gap: '1rem' }}>
      <header>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Dự án của tôi</h1>
        <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>IAM-SRS-006 · Issue #21 · Server lọc dữ liệu theo membership — thao tác ngoài phạm vi bị từ chối.</p>
      </header>
      <ProjectsList />
    </main>
  );
}
