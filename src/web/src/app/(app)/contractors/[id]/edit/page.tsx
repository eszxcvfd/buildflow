'use client';

import * as React from 'react';
import { getContractor, type Contractor } from '@/lib/api/contractors';
import type { ApiError } from '@/lib/api/contractors';
import { ContractorForm } from '@/features/contractors';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
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

  return (
    <>
      <PageHeader
        title="Sửa nhà thầu"
        subtitle="Cập nhật thông tin định danh, liên hệ, phạm vi công việc và trạng thái."
      />
      {loading ? (
        <Card><p aria-busy="true">Đang tải…</p></Card>
      ) : error ? (
        <Card>
          {error.status === 401 ? <Alert tone="error">Phiên hết hạn (401)</Alert> : null}
          {error.status === 403 ? <Alert tone="error">Không có quyền (403)</Alert> : null}
          {error.status === 404 ? <Alert tone="error">Không tìm thấy (404)</Alert> : null}
          {error.status !== 401 && error.status !== 403 && error.status !== 404 ? (
            <>
              <Alert tone="error">{error.message}</Alert>
              <div style={{ marginTop: '0.75rem' }}>
                <Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>Thử lại</Button>
              </div>
            </>
          ) : null}
        </Card>
      ) : contractor ? (
        <ContractorForm mode="edit" initial={contractor} />
      ) : (
        <Card><p>Không có dữ liệu.</p></Card>
      )}
    </>
  );
}
