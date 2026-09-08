'use client';

import * as React from 'react';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { AdminUserRoleAssign } from './AdminUserRoleAssign';

/**
 * Dialog "Gán vai trò" trên /admin/users (CRUD popup như Sửa tài khoản/công nhân).
 * Tái dùng AdminUserRoleAssign nguyên vẹn (ids/texts/asserts giữ nguyên — form tự
 * load data theo userId, PUT contract không đổi); submit thành công → toast
 * (trong form) + đóng dialog + báo onUpdated để list refresh.
 * Route /admin/users/:id/roles giữ hoạt động độc lập cho truy cập trực tiếp.
 */
export function AdminUserRolesDialog({
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
    <Dialog title="Gán vai trò" open onClose={onClose} className="max-w-2xl">
      <AdminUserRoleAssign
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
