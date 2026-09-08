'use client';

import * as React from 'react';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { Button } from '@/components/ui/button/Button';
import { useViewMode, ViewToggle } from '@/components/ui/kanban/KanbanView';
import { useCanManageProjects } from '@/lib/auth/roles';
import { ProjectsList } from './ProjectsList';
import { ProjectCreateDialog } from './ProjectCreateDialog';
import { ProjectsKanban } from './ProjectsKanban';

/**
 * /projects — PageHeader (toggle Bảng|Kanban + nút "Thêm mới" cùng hàng
 * actions: toggle trái, nút thêm phải) + ProjectsList/ProjectsKanban +
 * dialog tạo mới.
 * Nút header (gated quyền quản lý dự án như ProjectsHeaderActions cũ) là
 * CTA thêm duy nhất của trang; tạo thành công → đóng + refresh list
 * (remount ProjectsList qua key). Route /projects/new giữ nguyên cho E2E
 * drivers goto trực tiếp.
 * Mặc định = Bảng (?view=kanban để share kanban).
 */
export function ProjectsView() {
  const canManage = useCanManageProjects();
  const [seq, setSeq] = React.useState(0);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [view, setView] = useViewMode();
  const openCreate = React.useCallback(() => setCreateOpen(true), []);
  const closeCreate = React.useCallback(() => setCreateOpen(false), []);

  return (
    <>
      <PageHeader
        title="Dự án"
        subtitle="Các dự án bạn là thành viên — server lọc theo quyền"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <ViewToggle value={view} onChange={setView} />
            {canManage ? (
              <Button onClick={openCreate}>
                Thêm mới
              </Button>
            ) : null}
          </div>
        }
      />
      {view === 'kanban' ? <ProjectsKanban key={seq} /> : <ProjectsList key={seq} />}
      <ProjectCreateDialog
        open={createOpen}
        onClose={closeCreate}
        onCreated={() => setSeq((s) => s + 1)}
      />
    </>
  );
}
