'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { TradeForm } from './TradeForm';

/**
 * Dialog "Thêm ngành nghề" trên /trades (DashCode: tạo mới là dialog form,
 * không phải trang riêng). Tái dùng TradeForm mode=create nguyên vẹn
 * (ids/texts/asserts giữ nguyên); submit thành công → toast (trong form) +
 * đóng dialog + báo onCreated để list refresh. Route /trades/new giữ
 * hoạt động độc lập cho E2E drivers.
 */
export function TradeCreateDialog({
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
    <Dialog title="Thêm ngành nghề" open onClose={onClose} className="max-w-2xl">
      <TradeForm
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
