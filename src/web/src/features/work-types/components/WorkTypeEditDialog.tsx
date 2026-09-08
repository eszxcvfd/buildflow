'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { getWorkType, type WorkType, type ApiError } from '@/lib/api/work-types';
import { WorkTypeForm } from './WorkTypeForm';

/**
 * Dialog "Sửa loại công việc" trên /work-types/:id. Tải profile theo id rồi
 * tái dùng WorkTypeForm mode=edit (prefill đủ fields incl. requiredFields
 * builder + expectedConfigVersion từ configVersion hiện tại).
 * Lỗi 409 WORK_TYPE_CONFIG_CONFLICT hiển thị notice trong form kèm nút tải lại.
 */
export function WorkTypeEditDialog({
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
  const [workType, setWorkType] = React.useState<WorkType | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);

  React.useEffect(() => {
    if (!open || !id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setWorkType(null);
    (async () => {
      try {
        const t = await getWorkType(id);
        if (!cancelled) setWorkType(t);
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
    <Dialog title="Sửa loại công việc" open onClose={onClose} className="max-w-2xl">
      {loading ? (
        <p aria-busy="true">Đang tải…</p>
      ) : error ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {error.status === 401 ? <Alert tone="error">Phiên hết hạn (401)</Alert> : null}
          {error.status === 403 ? <Alert tone="error">Không có quyền (403)</Alert> : null}
          {error.status === 404 ? <Alert tone="error">Không tìm thấy loại công việc (404)</Alert> : null}
          {error.status !== 401 && error.status !== 403 && error.status !== 404 ? (
            <Alert tone="error">{error.message}</Alert>
          ) : null}
          <div>
            <Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>Thử lại</Button>
          </div>
        </div>
      ) : workType ? (
        <WorkTypeForm
          mode="edit"
          initial={workType}
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
