'use client';

import * as React from 'react';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { Button } from '@/components/ui/button/Button';
import { WorkerList } from './WorkerList';
import { WorkerCreateDialog } from './WorkerCreateDialog';

/**
 * /workers — PageHeader + WorkerList + dialog "Thêm công nhân".
 * Nút header và CTA empty-state đều mở dialog; tạo thành công → đóng +
 * refresh list (remount WorkerList qua key). Route /workers/new giữ nguyên
 * cho E2E drivers goto trực tiếp.
 */
export function WorkersView() {
  const [seq, setSeq] = React.useState(0);
  const [createOpen, setCreateOpen] = React.useState(false);
  const openCreate = React.useCallback(() => setCreateOpen(true), []);
  const closeCreate = React.useCallback(() => setCreateOpen(false), []);

  return (
    <>
      <PageHeader
        title="Công nhân"
        subtitle="Quản lý hồ sơ công nhân — tạo mới, tìm kiếm, cập nhật và chuyển trạng thái hoạt động."
        actions={
          <Button onClick={openCreate}>
            Thêm công nhân
          </Button>
        }
      />
      <WorkerList key={seq} onCreateRequest={openCreate} />
      <WorkerCreateDialog
        open={createOpen}
        onClose={closeCreate}
        onCreated={() => setSeq((s) => s + 1)}
      />
    </>
  );
}
