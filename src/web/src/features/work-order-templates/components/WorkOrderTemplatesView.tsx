'use client';

import * as React from 'react';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { Button } from '@/components/ui/button/Button';
import { WorkOrderTemplatesList } from './WorkOrderTemplatesList';
import { WorkOrderTemplateCreateDialog } from './WorkOrderTemplateCreateDialog';

/**
 * /work-order-templates — PageHeader (nút "Thêm mới") + WorkOrderTemplatesList
 * (table duy nhất, không kanban: trạng thái DRAFT/ACTIVE/INACTIVE) + dialog tạo mới.
 * Tạo thành công → đóng + refresh list (remount qua key).
 */
export function WorkOrderTemplatesView() {
  const [seq, setSeq] = React.useState(0);
  const [createOpen, setCreateOpen] = React.useState(false);
  const openCreate = React.useCallback(() => setCreateOpen(true), []);
  const closeCreate = React.useCallback(() => setCreateOpen(false), []);

  return (
    <>
      <PageHeader
        title="Mẫu công việc"
        subtitle="Danh mục mẫu công việc — mô tả, thời lượng, kỹ năng và checklist dùng khi tạo work order. Mẫu Nháp cần kích hoạt trước khi dùng."
        actions={
          <Button onClick={openCreate}>
            Thêm mới
          </Button>
        }
      />
      <WorkOrderTemplatesList key={seq} />
      <WorkOrderTemplateCreateDialog
        open={createOpen}
        onClose={closeCreate}
        onCreated={() => setSeq((s) => s + 1)}
      />
    </>
  );
}
