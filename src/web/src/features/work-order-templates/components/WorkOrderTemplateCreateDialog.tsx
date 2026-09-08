'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { WorkOrderTemplateForm } from './WorkOrderTemplateForm';

/**
 * Dialog "Thêm mẫu công việc" trên /work-order-templates. Tái dùng
 * WorkOrderTemplateForm mode=create; submit thành công → toast (trong form) +
 * đóng dialog + báo onCreated để list refresh.
 */
export function WorkOrderTemplateCreateDialog({
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
    <Dialog title="Thêm mẫu công việc" open onClose={onClose} className="max-w-2xl">
      <WorkOrderTemplateForm
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
