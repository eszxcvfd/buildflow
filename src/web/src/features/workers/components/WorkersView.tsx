'use client';

import * as React from 'react';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { Button } from '@/components/ui/button/Button';
import { useViewMode, ViewToggle } from '@/components/ui/kanban/KanbanView';
import { WorkerList } from './WorkerList';
import { WorkerCreateDialog } from './WorkerCreateDialog';
import { WorkersKanban } from './WorkersKanban';

/**
 * /workers — PageHeader (toggle Bảng|Kanban + nút "Thêm mới" cùng hàng
 * actions: toggle trái, nút thêm phải) + WorkerList/WorkersKanban +
 * dialog tạo mới.
 * Nút header là CTA thêm duy nhất của trang (WorkerList không còn nút/CTA
 * thêm riêng — empty-state chỉ còn copy hướng dẫn); tạo thành công → đóng +
 * refresh list (remount WorkerList qua key). Route /workers/new giữ nguyên
 * cho E2E drivers goto trực tiếp.
 * Mặc định = Bảng (?view=kanban để share kanban).
 */
export function WorkersView() {
  const [seq, setSeq] = React.useState(0);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [view, setView] = useViewMode();
  const openCreate = React.useCallback(() => setCreateOpen(true), []);
  const closeCreate = React.useCallback(() => setCreateOpen(false), []);

  return (
    <>
      <PageHeader
        title="Công nhân"
        subtitle="Quản lý hồ sơ công nhân — tạo mới, tìm kiếm, cập nhật và chuyển trạng thái hoạt động."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <ViewToggle value={view} onChange={setView} />
            <Button onClick={openCreate}>
              Thêm mới
            </Button>
          </div>
        }
      />
      {view === 'kanban' ? <WorkersKanban key={seq} /> : <WorkerList key={seq} />}
      <WorkerCreateDialog
        open={createOpen}
        onClose={closeCreate}
        onCreated={() => setSeq((s) => s + 1)}
      />
    </>
  );
}
