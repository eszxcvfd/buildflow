'use client';

import * as React from 'react';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { Button } from '@/components/ui/button/Button';
import { useViewMode, ViewToggle } from '@/components/ui/kanban/KanbanView';
import { CrewList } from './CrewList';
import { CrewCreateDialog } from './CrewCreateDialog';
import { CrewsKanban } from './CrewsKanban';

/**
 * /crews — PageHeader + toggle Bảng|Kanban + CrewList/CrewsKanban + dialog
 * "Thêm đội thi công".
 * Nút header và CTA empty-state đều mở dialog; tạo thành công → đóng +
 * refresh list (remount CrewList qua key). Route /crews/new giữ nguyên
 * cho E2E drivers goto trực tiếp.
 * Mặc định = Bảng (?view=kanban để share kanban); toggle nằm cạnh toolbar.
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
          <Button onClick={openCreate}>
            Thêm đội thi công
          </Button>
        }
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <ViewToggle value={view} onChange={setView} />
      </div>
      {view === 'kanban' ? <CrewsKanban key={seq} /> : <CrewList key={seq} onCreateRequest={openCreate} />}
      <CrewCreateDialog
        open={createOpen}
        onClose={closeCreate}
        onCreated={() => setSeq((s) => s + 1)}
      />
    </>
  );
}
