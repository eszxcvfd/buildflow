'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { getWorker, type Worker, type ApiError } from '@/lib/api/workers';
import { WorkerForm } from './WorkerForm';

/**
 * Dialog "Sửa công nhân" trên /workers/:id (CRUD popup như giao diện thêm mới).
 * Tái dùng WorkerForm mode=edit nguyên vẹn (ids/texts/asserts giữ nguyên);
 * load data theo id (PATCH contract không đổi); submit thành công → toast
 * (trong form) + đóng dialog + báo onUpdated để detail refresh.
 * Route /workers/:id/edit giữ hoạt động độc lập cho E2E drivers goto trực tiếp.
 */
export function WorkerEditDialog({
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
  const [worker, setWorker] = React.useState<Worker | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);

  React.useEffect(() => {
    if (!open || !id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setWorker(null);
    (async () => {
      try {
        const w = await getWorker(id);
        if (!cancelled) setWorker(w);
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
    <Dialog title="Sửa công nhân" open onClose={onClose} className="max-w-2xl">
      {loading ? (
        <p aria-busy="true">Đang tải…</p>
      ) : error ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {error.status === 401 ? <Alert tone="error">Phiên hết hạn (401)</Alert> : null}
          {error.status === 403 ? <Alert tone="error">Không có quyền (403)</Alert> : null}
          {error.status === 404 ? <Alert tone="error">Không tìm thấy công nhân (404)</Alert> : null}
          {error.status !== 401 && error.status !== 403 && error.status !== 404 ? (
            <Alert tone="error">{error.message}</Alert>
          ) : null}
          <div>
            <Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>Thử lại</Button>
          </div>
        </div>
      ) : worker ? (
        <WorkerForm
          mode="edit"
          initial={worker}
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
