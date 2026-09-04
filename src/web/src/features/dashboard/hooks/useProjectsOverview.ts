'use client';

import * as React from 'react';
import { listProjects, type Project } from '@/lib/api/projects';

export interface ProjectsOverview {
  projects: Project[];
  loading: boolean;
  error: unknown;
}

/**
 * Tải danh sách dự án một lần cho trang dashboard (KPI "Dự án" + bảng gần đây).
 * Lỗi được giữ nguyên để caller tự quyết định hiển thị — không làm sập page.
 */
export function useProjectsOverview(): ProjectsOverview {
  const [state, setState] = React.useState<ProjectsOverview>({ projects: [], loading: true, error: null });

  React.useEffect(() => {
    let alive = true;
    listProjects({ limit: 100 }).then(
      (data) => {
        if (alive) setState({ projects: data, loading: false, error: null });
      },
      (e: unknown) => {
        if (alive) setState({ projects: [], loading: false, error: e });
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
