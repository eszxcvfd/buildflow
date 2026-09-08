'use client';

import * as React from 'react';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { Button } from '@/components/ui/button/Button';
import { useViewMode, ViewToggle } from '@/components/ui/kanban/KanbanView';
import { ContractorList } from './ContractorList';
import { ContractorCreateDialog } from './ContractorCreateDialog';
import { ContractorsKanban } from './ContractorsKanban';

/**
 * /contractors — PageHeader + toggle Bảng|Kanban + ContractorList/
 * ContractorsKanban + dialog "Thêm nhà thầu".
 * Nút header và CTA empty-state đều mở dialog; tạo thành công → đóng +
 * refresh list (remount ContractorList qua key). Route /contractors/new giữ
 * nguyên cho E2E drivers goto trực tiếp.
 * Mặc định = Bảng (?view=kanban để share kanban); toggle nằm cạnh toolbar.
 */
export function ContractorsView() {
  const [seq, setSeq] = React.useState(0);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [view, setView] = useViewMode();
  const openCreate = React.useCallback(() => setCreateOpen(true), []);
  const closeCreate = React.useCallback(() => setCreateOpen(false), []);

  return (
    <>
      <PageHeader
        title="Nhà thầu"
        subtitle="Danh sách nhà thầu của công ty — nguồn chọn khi phân công công việc."
        actions={
          <Button onClick={openCreate}>
            Thêm nhà thầu
          </Button>
        }
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <ViewToggle value={view} onChange={setView} />
      </div>
      {view === 'kanban' ? <ContractorsKanban key={seq} /> : <ContractorList key={seq} onCreateRequest={openCreate} />}
      <ContractorCreateDialog
        open={createOpen}
        onClose={closeCreate}
        onCreated={() => setSeq((s) => s + 1)}
      />
    </>
  );
}
