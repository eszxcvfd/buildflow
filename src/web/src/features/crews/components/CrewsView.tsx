'use client';

import * as React from 'react';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { Button } from '@/components/ui/button/Button';
import { useViewMode, ViewToggle } from '@/components/ui/kanban/KanbanView';
import { CrewList } from './CrewList';
import { CrewCreateDialog } from './CrewCreateDialog';
import { CrewsKanban } from './CrewsKanban';

/**
 * /crews — PageHeader (toggle Bảng|Kanban + nút "Thêm mới" cùng hàng
 * actions: toggle trái, nút thêm phải) + CrewList/CrewsKanban + dialog
 * tạo mới.
 * Nút header là CTA thêm duy nhất của trang (CrewList không còn nút/CTA
 * thêm riêng); tạo thành công → đóng + refresh list (remount CrewList qua
 * key). Route /crews/new giữ nguyên cho E2E drivers goto trực tiếp.
 * Mặc định = Bảng (?view=kanban để share kanban).
 */
export function CrewsView() {
  const [seq, setSeq] = React.useState(0);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [view, setView] = useViewMode();
  const openCreate = React.useCallback(() => setCreateOpen(true), []);
  const closeCreate = React.useCallback(() => setCreateOpen(false), []);

  return (
    <>
      <PageHeader
        title="Đội thi công"
        subtitle="Danh sách đội thi công — tạo đội, chỉ định trưởng nhóm và cập nhật trạng thái. Đội ngừng hoạt động không nhận phân công mới."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <ViewToggle value={view} onChange={setView} />
            <Button onClick={openCreate}>
              Thêm mới
            </Button>
          </div>
        }
      />
      {view === 'kanban' ? <CrewsKanban key={seq} /> : <CrewList key={seq} />}
      <CrewCreateDialog
        open={createOpen}
        onClose={closeCreate}
        onCreated={() => setSeq((s) => s + 1)}
      />
    </>
  );
}
