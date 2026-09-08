'use client';

import * as React from 'react';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { Button } from '@/components/ui/button/Button';
import { WorkTypesList } from './WorkTypesList';
import { WorkTypeCreateDialog } from './WorkTypeCreateDialog';

/**
 * /work-types — PageHeader (nút "Thêm mới") + WorkTypesList (table duy nhất,
 * không kanban: trạng thái chỉ ACTIVE/INACTIVE) + dialog tạo mới.
 * Tạo thành công → đóng + refresh list (remount qua key).
 */
export function WorkTypesView() {
  const [seq, setSeq] = React.useState(0);
  const [createOpen, setCreateOpen] = React.useState(false);
  const openCreate = React.useCallback(() => setCreateOpen(true), []);
  const closeCreate = React.useCallback(() => setCreateOpen(false), []);

  return (
    <>
      <PageHeader
        title="Loại công việc"
        subtitle="Danh mục loại công việc — nhóm, ngành nghề yêu cầu và dữ liệu bắt buộc khi nghiệm thu. Nguồn chọn cho work order."
        actions={
          <Button onClick={openCreate}>
            Thêm mới
          </Button>
        }
      />
      <WorkTypesList key={seq} />
      <WorkTypeCreateDialog
        open={createOpen}
        onClose={closeCreate}
        onCreated={() => setSeq((s) => s + 1)}
      />
    </>
  );
}
