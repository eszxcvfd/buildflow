'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { getCrew, type Crew, type ApiError } from '@/lib/api/crews';
import { CrewForm } from './CrewForm';

/**
 * Dialog "Sửa đội …" trên /crews/:id (CRUD popup như giao diện thêm mới).
 * Tái dùng CrewForm mode=edit nguyên vẹn (ids/texts/asserts giữ nguyên);
 * load data theo id (PATCH contract không đổi — mã đội không đổi sau khi tạo);
 * submit thành công → toast (trong form) + đóng dialog + báo onUpdated để
 * detail refresh. Route /crews/:id/edit giữ hoạt động độc lập cho E2E drivers
 * goto trực tiếp.
 */
export function CrewEditDialog({
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
  const [crew, setCrew] = React.useState<Crew | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);

  React.useEffect(() => {
    if (!open || !id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCrew(null);
    (async () => {
      try {
        const c = await getCrew(id);
        if (!cancelled) setCrew(c);
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
    <Dialog title={crew ? `Sửa đội ${crew.code}` : 'Sửa đội thi công'} open onClose={onClose} className="max-w-2xl">
      {loading ? (
        <p aria-busy="true">Đang tải hồ sơ đội thi công…</p>
      ) : error ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <Alert tone="error">
            {error.status === 404
              ? 'Không tìm thấy đội thi công (404)'
              : error.status === 401
                ? 'Phiên hết hạn, vui lòng đăng nhập lại (401)'
                : error.status === 403
                  ? 'Không có quyền — cần ADMIN hoặc PROJECT_MANAGER (403)'
                  : (error.message ?? 'Không thể tải hồ sơ đội thi công')}
          </Alert>
          <div>
            <Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>Thử lại</Button>
          </div>
        </div>
      ) : crew ? (
        <CrewForm
          mode="edit"
          initial={crew}
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
