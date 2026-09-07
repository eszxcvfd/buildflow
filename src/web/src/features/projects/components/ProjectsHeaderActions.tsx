'use client';

import { useCanManageProjects } from '@/lib/auth/roles';

/** CTA 'Tạo dự án' cho PageHeader (gated quyền quản lý dự án). */
export function ProjectsHeaderActions() {
  const canManage = useCanManageProjects();
  if (!canManage) return null;
  return (
    <a className="bf-btn bf-btn-primary" href="/projects/new">
      Tạo dự án
    </a>
  );
}
