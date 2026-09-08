'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { WorkerForm } from './WorkerForm';

/**
 * Dialog "Thêm công nhân" trên /workers (DashCode: tạo mới là dialog form,
 * không phải trang riêng). Tái dùng WorkerForm mode=create nguyên vẹn
 * (ids/texts/asserts giữ nguyên); submit thành công → toast (trong form) +
 * đóng dialog + báo onCreated để list refresh. Route /workers/new giữ
 * hoạt động độc lập cho E2E drivers.
 */
export function WorkerCreateDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  if (!open) return null;
  return (
    <Dialog title="Thêm công nhân" open onClose={onClose} className="max-w-2xl">
      <WorkerForm
        mode="create"
        onSuccess={() => {
          onCreated?.();
          onClose();
        }}
        onCancel={onClose}
      />
    </Dialog>
  );
}
