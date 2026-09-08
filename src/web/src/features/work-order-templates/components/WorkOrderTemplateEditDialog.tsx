'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { getWorkOrderTemplate, type WorkOrderTemplate, type ApiError } from '@/lib/api/work-order-templates';
import { WorkOrderTemplateForm } from './WorkOrderTemplateForm';

/**
 * Dialog "Sửa mẫu công việc" trên /work-order-templates/:id. Tải profile theo id
 * rồi tái dùng WorkOrderTemplateForm mode=edit (prefill đủ fields incl. skills +
 * checklist builder + expectedVersion từ version hiện tại).
 * Lỗi 409 WORK_ORDER_TEMPLATE_CONFIG_CONFLICT hiển thị notice trong form kèm nút tải lại.
 */
export function WorkOrderTemplateEditDialog({
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
  const [template, setTemplate] = React.useState<WorkOrderTemplate | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);

  React.useEffect(() => {
    if (!open || !id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTemplate(null);
    (async () => {
      try {
        const t = await getWorkOrderTemplate(id);
        if (!cancelled) setTemplate(t);
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
    <Dialog title="Sửa mẫu công việc" open onClose={onClose} className="max-w-2xl">
      {loading ? (
        <p aria-busy="true">Đang tải…</p>
      ) : error ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {error.status === 401 ? <Alert tone="error">Phiên hết hạn (401)</Alert> : null}
          {error.status === 403 ? <Alert tone="error">Không có quyền (403)</Alert> : null}
          {error.status === 404 ? <Alert tone="error">Không tìm thấy mẫu công việc (404)</Alert> : null}
          {error.status !== 401 && error.status !== 403 && error.status !== 404 ? (
            <Alert tone="error">{error.message}</Alert>
          ) : null}
          <div>
            <Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>Thử lại</Button>
          </div>
        </div>
      ) : template ? (
        <WorkOrderTemplateForm
          mode="edit"
          initial={template}
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
