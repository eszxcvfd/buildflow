'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { getProject, type Project, type ApiError } from '@/lib/api/projects';
import { ProjectForm } from './ProjectForm';

/**
 * Dialog "Sửa dự án …" trên /projects/:id (CRUD popup như giao diện thêm mới).
 * Tái dùng ProjectForm mode=edit nguyên vẹn (ids/texts/asserts giữ nguyên);
 * load data theo id (PATCH contract không đổi — mã dự án không đổi sau khi tạo);
 * submit thành công → toast (trong form) + đóng dialog + báo onUpdated để
 * detail refresh. Route /projects/:id/edit giữ hoạt động độc lập cho E2E
 * drivers goto trực tiếp.
 */
export function ProjectEditDialog({
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
  const [project, setProject] = React.useState<Project | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);

  React.useEffect(() => {
    if (!open || !id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProject(null);
    (async () => {
      try {
        const p = await getProject(id);
        if (!cancelled) setProject(p);
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
    <Dialog title={project ? `Sửa dự án ${project.code}` : 'Sửa dự án'} open onClose={onClose} className="max-w-2xl">
      {loading ? (
        <p aria-busy="true">Đang tải hồ sơ dự án…</p>
      ) : error ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <Alert tone="error">
            {error.status === 404
              ? 'Không tìm thấy dự án (404)'
              : error.status === 401
                ? 'Phiên hết hạn, vui lòng đăng nhập lại (401)'
                : error.status === 403
                  ? 'Không có quyền — cần ADMIN hoặc PROJECT_MANAGER (403)'
                  : (error.message ?? 'Không thể tải hồ sơ dự án')}
          </Alert>
          <div>
            <Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>Thử lại</Button>
          </div>
        </div>
      ) : project ? (
        <ProjectForm
          mode="edit"
          initial={project}
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
