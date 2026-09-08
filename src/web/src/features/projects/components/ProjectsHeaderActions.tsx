'use client';

import { useCanManageProjects } from '@/lib/auth/roles';

/** CTA 'Thêm mới' cho PageHeader (gated quyền quản lý dự án). */
export function ProjectsHeaderActions() {
  const canManage = useCanManageProjects();
  if (!canManage) return null;
  return (
    <a className="bf-btn bf-btn-primary" href="/projects/new">
      Thêm mới
    </a>
  );
}
