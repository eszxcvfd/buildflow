'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { ContractorForm } from './ContractorForm';

/**
 * Dialog "Thêm nhà thầu" trên /contractors (DashCode: tạo mới là dialog form,
 * không phải trang riêng). Tái dùng ContractorForm mode=create nguyên vẹn
 * (ids/texts/asserts giữ nguyên); submit thành công → toast (trong form) +
 * đóng dialog + báo onCreated để list refresh. Route /contractors/new giữ
 * hoạt động độc lập cho E2E drivers.
 */
export function ContractorCreateDialog({
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
    <Dialog title="Thêm nhà thầu" open onClose={onClose} className="max-w-2xl">
      <ContractorForm
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
