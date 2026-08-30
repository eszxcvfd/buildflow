'use client';

import * as React from 'react';
import { getContractor, type Contractor } from '@/lib/api/contractors';
import type { ApiError } from '@/lib/api/contractors';
import { ContractorForm } from '@/features/contractors';
import { Alert } from '@/components/ui/alert/Alert';
import { Card } from '@/components/ui/card/Card';
import { Button } from '@/components/ui/button/Button';

export default function ContractorEditPage({ params }: { params: { id: string } }) {
  const [contractor, setContractor] = React.useState<Contractor | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const c = await getContractor(params.id);
        if (!cancelled) setContractor(c);
      } catch (e) {
        if (!cancelled) setError(e as ApiError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [params.id, retryKey]);

  if (loading) return <main style={{ padding: '2rem' }}><Card><p aria-busy="true">Đang tải…</p></Card></main>;
  if (error) {
    if (error.status === 401) return <main style={{ padding: '2rem' }}><Card><Alert tone="error">Phiên hết hạn (401)</Alert></Card></main>;
    if (error.status === 403) return <main style={{ padding: '2rem' }}><Card><Alert tone="error">Không có quyền (403)</Alert></Card></main>;
    if (error.status === 404) return <main style={{ padding: '2rem' }}><Card><Alert tone="error">Không tìm thấy (404)</Alert></Card></main>;
    return <main style={{ padding: '2rem' }}><Card><Alert tone="error">{error.message}</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>Thử lại</Button></div></Card></main>;
  }
  if (!contractor) return <main style={{ padding: '2rem' }}><Card><p>Không có dữ liệu.</p></Card></main>;

  return (
    <main style={{ padding: '2rem', maxWidth: 760, margin: '0 auto' }}>
      <ContractorForm mode="edit" initial={contractor} />
    </main>
  );
}
