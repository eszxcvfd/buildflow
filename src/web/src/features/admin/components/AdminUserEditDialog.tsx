'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { AdminUserEditForm } from './AdminUserForm';

/**
 * Dialog "Sửa tài khoản" trên /admin/users (CRUD popup như giao diện thêm mới).
 * Tái dùng AdminUserEditForm nguyên vẹn (ids/texts/asserts giữ nguyên — form tự
 * load data theo userId, PATCH contract không đổi); submit thành công → toast
 * (trong form) + đóng dialog + báo onUpdated để list refresh.
 * Route /admin/users/:id/edit giữ hoạt động độc lập cho E2E drivers goto trực tiếp.
 */
export function AdminUserEditDialog({
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
  if (!open) return null;
  return (
    <Dialog title="Sửa tài khoản" open onClose={onClose} className="max-w-2xl">
      <AdminUserEditForm
        key={id}
        userId={id}
        onSuccess={() => {
          onClose();
          onUpdated?.();
        }}
        onCancel={onClose}
      />
    </Dialog>
  );
}
