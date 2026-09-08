'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { ProjectForm } from './ProjectForm';

/**
 * Dialog "Tạo dự án" trên /projects (DashCode: tạo mới là dialog form,
 * không phải trang riêng). Tái dùng ProjectForm mode=create nguyên vẹn
 * (ids/texts/asserts giữ nguyên); submit thành công → toast (trong form) +
 * đóng dialog + báo onCreated để list refresh. Route /projects/new giữ
 * hoạt động độc lập cho E2E drivers.
 */
export function ProjectCreateDialog({
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
    <Dialog title="Tạo dự án" open onClose={onClose} className="max-w-2xl">
      <ProjectForm
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
