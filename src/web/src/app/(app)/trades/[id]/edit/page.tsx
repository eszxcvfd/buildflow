'use client';

import * as React from 'react';
import { getTrade, type Trade } from '@/lib/api/trades';
import type { ApiError } from '@/lib/api/trades';
import { TradeForm } from '@/features/trades';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { Alert } from '@/components/ui/alert/Alert';
import { Card } from '@/components/ui/card/Card';
import { Button } from '@/components/ui/button/Button';

export default function TradeEditPage({ params }: { params: { id: string } }) {
  const [trade, setTrade] = React.useState<Trade | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const t = await getTrade(params.id);
        if (!cancelled) setTrade(t);
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
        title="Sửa ngành nghề"
        subtitle="Cập nhật mã, tên hoặc mô tả của danh mục ngành nghề/kỹ năng."
      />
      {loading ? (
        <Card><p aria-busy="true">Đang tải…</p></Card>
      ) : error ? (
        <Card>
          {error.status === 401 ? <Alert tone="error">Phiên hết hạn (401)</Alert> : null}
          {error.status === 403 ? <Alert tone="error">Không có quyền (403)</Alert> : null}
          {error.status === 404 ? <Alert tone="error">Không tìm thấy ngành nghề (404)</Alert> : null}
          {error.status !== 401 && error.status !== 403 && error.status !== 404 ? (
            <>
              <Alert tone="error">{error.message}</Alert>
              <div style={{ marginTop: '0.75rem' }}>
                <Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>Thử lại</Button>
              </div>
            </>
          ) : null}
        </Card>
      ) : trade ? (
        <TradeForm mode="edit" initial={trade} />
      ) : (
        <Card><p>Không có dữ liệu.</p></Card>
      )}
    </>
  );
}
