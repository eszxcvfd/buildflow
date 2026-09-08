'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { CrewForm } from './CrewForm';

/**
 * Dialog "Thêm đội thi công" trên /crews (DashCode: tạo mới là dialog form,
 * không phải trang riêng). Tái dùng CrewForm mode=create nguyên vẹn
 * (ids/texts/asserts giữ nguyên); submit thành công → toast (trong form) +
 * đóng dialog + báo onCreated để list refresh. Route /crews/new giữ
 * hoạt động độc lập cho E2E drivers.
 */
export function CrewCreateDialog({
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
    <Dialog title="Thêm đội thi công" open onClose={onClose} className="max-w-2xl">
      <CrewForm
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
