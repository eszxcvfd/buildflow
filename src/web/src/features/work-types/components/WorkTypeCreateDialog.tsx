'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { WorkTypeForm } from './WorkTypeForm';

/**
 * Dialog "Thêm loại công việc" trên /work-types. Tái dùng WorkTypeForm
 * mode=create; submit thành công → toast (trong form) + đóng dialog + báo
 * onCreated để list refresh.
 */
export function WorkTypeCreateDialog({
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
    <Dialog title="Thêm loại công việc" open onClose={onClose} className="max-w-2xl">
      <WorkTypeForm
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
