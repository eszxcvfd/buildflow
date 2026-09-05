'use client';

import * as React from 'react';
import { getWorker, type Worker } from '@/lib/api/workers';
import type { ApiError } from '@/lib/api/workers';
import { WorkerForm } from '@/features/workers';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { Alert } from '@/components/ui/alert/Alert';
import { Card } from '@/components/ui/card/Card';
import { Button } from '@/components/ui/button/Button';

export default function WorkerEditPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [worker, setWorker] = React.useState<Worker | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const w = await getWorker(id);
        if (!cancelled) setWorker(w);
      } catch (e) {
        if (!cancelled) setError(e as ApiError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id, retryKey]);

  return (
    <>
      <PageHeader
        title="Sửa công nhân"
        subtitle="Cập nhật thông tin định danh, liên hệ, ngành nghề và kỹ năng."
      />
      {loading ? (
        <Card><p aria-busy="true">Đang tải…</p></Card>
      ) : error ? (
        <Card>
          {error.status === 401 ? <Alert tone="error">Phiên hết hạn (401)</Alert> : null}
          {error.status === 403 ? <Alert tone="error">Không có quyền (403)</Alert> : null}
          {error.status === 404 ? <Alert tone="error">Không tìm thấy công nhân (404)</Alert> : null}
          {error.status !== 401 && error.status !== 403 && error.status !== 404 ? (
            <>
              <Alert tone="error">{error.message}</Alert>
              <div style={{ marginTop: '0.75rem' }}>
                <Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>Thử lại</Button>
              </div>
            </>
          ) : null}
        </Card>
      ) : worker ? (
        <WorkerForm mode="edit" initial={worker} />
      ) : (
        <Card><p>Không có dữ liệu.</p></Card>
      )}
    </>
  );
}
