'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { getTrade, type Trade, type ApiError } from '@/lib/api/trades';
import { TradeForm } from './TradeForm';

/**
 * Dialog "Sửa ngành nghề" trên /trades/:id (CRUD popup như giao diện thêm mới).
 * Tái dùng TradeForm mode=edit nguyên vẹn (ids/texts/asserts giữ nguyên);
 * load data theo id (PATCH contract không đổi); submit thành công → toast
 * (trong form) + đóng dialog + báo onUpdated để detail refresh.
 * Route /trades/:id/edit giữ hoạt động độc lập cho E2E drivers goto trực tiếp.
 */
export function TradeEditDialog({
  id,
  open,
  onClose,
  onUpdated,
}: {
  id: string;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const [trade, setTrade] = React.useState<Trade | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);

  React.useEffect(() => {
    if (!open || !id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTrade(null);
    (async () => {
      try {
        const t = await getTrade(id);
        if (!cancelled) setTrade(t);
      } catch (e) {
        if (!cancelled) setError(e as ApiError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, id, retryKey]);

  if (!open) return null;
  return (
    <Dialog title="Sửa ngành nghề" open onClose={onClose} className="max-w-2xl">
      {loading ? (
        <p aria-busy="true">Đang tải…</p>
      ) : error ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {error.status === 401 ? <Alert tone="error">Phiên hết hạn (401)</Alert> : null}
          {error.status === 403 ? <Alert tone="error">Không có quyền (403)</Alert> : null}
          {error.status === 404 ? <Alert tone="error">Không tìm thấy ngành nghề (404)</Alert> : null}
          {error.status !== 401 && error.status !== 403 && error.status !== 404 ? (
            <Alert tone="error">{error.message}</Alert>
          ) : null}
          <div>
            <Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>Thử lại</Button>
          </div>
        </div>
      ) : trade ? (
        <TradeForm
          mode="edit"
          initial={trade}
          onSuccess={() => {
            onClose();
            onUpdated?.();
          }}
          onCancel={onClose}
        />
      ) : (
        <p>Không có dữ liệu.</p>
      )}
    </Dialog>
  );
}
