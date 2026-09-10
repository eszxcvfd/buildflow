'use client';

import * as React from 'react';
import {
  changeProjectStatus,
  getProject,
  listProjectAreas,
  listProjectMembers,
  type Project,
  type ProjectMember,
  type ProjectStatusAction,
} from '@/lib/api/projects';
import { Alert } from '@/components/ui/alert/Alert';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import {
  BriefcaseIcon,
  CloseIcon,
  ExternalLinkIcon,
  FileTextIcon,
  PencilIcon,
  RefreshIcon,
} from '@/components/ui/icons/Icons';
import { useCanManageProjects } from '@/lib/auth/roles';
import { ProjectEditDialog } from './ProjectEditDialog';
import {
  PROJECT_ACTION_LABEL,
  ProjectStatusDialog,
  allowedProjectActionsFor,
} from './ProjectStatusDialog';

/**
 * Web redesign — Right Inspector 320px theo mẫu (header + quick actions +
 * thông tin cốt lõi + nhật ký hiện trường). Fetch-on-select: getProject +
 * lazy song song members/areas, có stale-response guard. Mọi ô không có
 * API → '—'/empty-state trung thực; quick actions chết của mock
 * ("Lịch thi công"/"Bản vẽ kỹ thuật") được thay bằng actions thật.
 */
export function ProjectInspector({
  projectId,
  refreshSeq = 0,
  onClose,
  onChanged,
}: {
  projectId: string;
  /** F012: parent bump sau edit/status-change → refetch getProject, hết stale-after-edit. */
  refreshSeq?: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const canManage = useCanManageProjects();
  const [project, setProject] = React.useState<Project | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  // F003 — members tách 3 trạng thái: pending → 'Đang tải…' (aria-busy);
  // fail → '—' + title lý do; empty (không có MANAGER active) → '—'.
  // userName null → '—' + title=userId (không render UUID như tên).
  const [membersPending, setMembersPending] = React.useState(false);
  const [membersError, setMembersError] = React.useState<string | null>(null);
  const [managerName, setManagerName] = React.useState<string | null>(null);
  const [managerUserId, setManagerUserId] = React.useState<string | null>(null);
  const [areaSummary, setAreaSummary] = React.useState<{ active: number; total: number } | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [statusAction, setStatusAction] = React.useState<ProjectStatusAction | null>(null);
  const [statusLoading, setStatusLoading] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setProject(null);
    setMembersPending(false);
    setMembersError(null);
    setManagerName(null);
    setManagerUserId(null);
    setAreaSummary(null);
    setNotice(null);
    setStatusAction(null);
    async function load() {
      try {
        const p = await getProject(projectId);
        if (cancelled) return;
        setProject(p);
        setLoading(false);
        setMembersPending(true);
        const [members, areas] = await Promise.all([
          listProjectMembers(projectId).catch((e: unknown) => ({ __error: e })),
          listProjectAreas(projectId).catch(() => null),
        ]);
        if (cancelled) return;
        setMembersPending(false);
        if (members && typeof members === 'object' && '__error' in members) {
          const e = (members as { __error: unknown }).__error;
          setMembersError(e instanceof Error ? e.message : 'Không tải được danh sách thành viên.');
          setManagerName(null);
          setManagerUserId(null);
        } else {
          setMembersError(null);
          const mgr: ProjectMember | undefined = (
            members as { data: ProjectMember[] }
          )?.data.find((m) => m.isActive && m.projectRole === 'MANAGER');
          setManagerName(mgr?.userName ?? null);
          setManagerUserId(mgr ? mgr.userId : null);
        }
        setAreaSummary(
          areas ? { active: areas.data.filter((a) => a.isActive).length, total: areas.total } : null,
        );
      } catch {
        if (!cancelled) {
          setLoadError('Không tải được thông tin dự án.');
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshSeq]);

  async function handleStatusConfirm(reason: string) {
    if (!project || !statusAction) return;
    const action = statusAction;
    setStatusLoading(true);
    setStatusMessage(null);
    try {
      const updated = await changeProjectStatus(project.id, { action, reason: reason || null });
      setProject({ ...project, status: updated.status, updatedAt: updated.updatedAt ?? project.updatedAt });
      setStatusAction(null);
      setNotice(
        updated.alreadyInState
          ? 'Dự án đã ở trạng thái này — không thay đổi gì thêm.'
          : `${PROJECT_ACTION_LABEL[action]} dự án thành công.`,
      );
      onChanged();
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : 'Đổi trạng thái thất bại.');
    } finally {
      setStatusLoading(false);
    }
  }

  const allowedActions = project ? allowedProjectActionsFor(project.status) : [];

  return (
    <aside
      className="prj-inspector flex w-80 flex-shrink-0 select-none flex-col overflow-y-auto border-l border-zinc-200 bg-white"
      aria-label="Chi tiết công trình"
      data-testid="project-inspector"
    >
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50/50 p-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="bf-mono rounded border border-blue-200 bg-blue-100 px-1.5 py-0.5 text-xs font-bold text-blue-700">
            {project?.code ?? '…'}
          </span>
          <span className="truncate text-xs font-semibold text-zinc-800">Chi tiết công trình</span>
        </div>
        <div className="flex items-center gap-1">
          <a
            href={`/projects/${projectId}`}
            aria-label="Mở trang chi tiết dự án"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <ExternalLinkIcon size={14} />
          </a>
          <button
            type="button"
            aria-label="Thu gọn panel chi tiết"
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4 text-xs">
        {loading ? (
          <p aria-busy="true" className="text-zinc-500">Đang tải chi tiết…</p>
        ) : loadError || !project ? (
          <Alert tone="error">{loadError ?? 'Không tải được thông tin dự án.'}</Alert>
        ) : (
          <>
            <div>
              <h2 className="text-sm font-bold leading-snug text-zinc-950">{project.name}</h2>
              <p className="bf-mono mt-0.5 text-[11px] text-zinc-400">
                {project.code} · Cập nhật {new Date(project.updatedAt).toLocaleDateString('vi-VN')}
                {areaSummary ? (areaSummary.total > 0 ? ` · Hạng mục ${areaSummary.active}/${areaSummary.total}` : ' · Hạng mục —') : ''}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <a
                href={`/projects/${project.id}`}
                className="flex items-center justify-center gap-1.5 rounded bg-zinc-100 px-2 py-1.5 font-medium text-zinc-700 hover:bg-zinc-200"
              >
                <FileTextIcon size={14} /> Chi tiết dự án
              </a>
              <a
                href={`/work-orders?projectId=${project.id}`}
                className="flex items-center justify-center gap-1.5 rounded bg-zinc-100 px-2 py-1.5 font-medium text-zinc-700 hover:bg-zinc-200"
              >
                <BriefcaseIcon size={14} /> Công việc
              </a>
              {canManage ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    className="flex items-center justify-center gap-1.5 rounded bg-zinc-100 px-2 py-1.5 font-medium text-zinc-700 hover:bg-zinc-200"
                  >
                    <PencilIcon size={14} /> Sửa hồ sơ
                  </button>
                  {allowedActions.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setStatusAction(allowedActions[0])}
                      title={allowedActions.map((a) => PROJECT_ACTION_LABEL[a]).join(', ')}
                      className="flex items-center justify-center gap-1.5 rounded bg-zinc-100 px-2 py-1.5 font-medium text-zinc-700 hover:bg-zinc-200"
                    >
                      <RefreshIcon size={14} /> Đổi trạng thái
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>

            {notice ? <Alert tone="info">{notice}</Alert> : null}

            <div className="space-y-2 border-t border-zinc-100 pt-3">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Thông tin cốt lõi
              </span>
              <div className="flex justify-between border-b border-zinc-100 py-1">
                <span className="text-zinc-500">Chỉ huy trưởng:</span>
                {membersPending ? (
                  <span aria-busy="true" className="font-medium text-zinc-400">Đang tải…</span>
                ) : managerName ? (
                  <span className="font-medium text-zinc-800">{managerName}</span>
                ) : (
                  <span
                    className="font-medium text-zinc-400"
                    title={membersError ?? managerUserId ?? 'Chưa có dữ liệu chỉ huy trưởng'}
                  >
                    —
                  </span>
                )}
              </div>
              {/* F001: địa chỉ read-side không có (chỉ nằm trong write profile)
                  → placeholder trung thực, không bỏ trống section. */}
              <div className="flex justify-between border-b border-zinc-100 py-1">
                <span className="text-zinc-500">Địa chỉ:</span>
                <span className="font-medium text-zinc-400" title="Chưa có dữ liệu địa chỉ">—</span>
              </div>
              <div className="flex justify-between border-b border-zinc-100 py-1">
                <span className="text-zinc-500">Tổng ngân sách:</span>
                <span className="bf-mono font-medium text-zinc-400">—</span>
              </div>
              <div className="flex justify-between border-b border-zinc-100 py-1">
                <span className="text-zinc-500">Đã thanh toán đợt:</span>
                <span className="bf-mono font-medium text-zinc-400">—</span>
              </div>
              <div className="flex justify-between border-b border-zinc-100 py-1">
                <span className="text-zinc-500">Nhân công hôm nay:</span>
                <span className="bf-mono font-medium text-zinc-400">—</span>
              </div>
              <div className="flex justify-between border-b border-zinc-100 py-1">
                <span className="text-zinc-500">Tạo lúc:</span>
                <span className="bf-mono font-medium text-zinc-800">
                  {new Date(project.createdAt).toLocaleDateString('vi-VN')}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-500">Cập nhật lúc:</span>
                <span className="bf-mono font-medium text-zinc-800">
                  {new Date(project.updatedAt).toLocaleDateString('vi-VN')}
                </span>
              </div>
            </div>

            <div className="space-y-2 border-t border-zinc-100 pt-3">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Nhật ký hiện trường gần nhất
              </span>
              <EmptyState title="Chưa có nhật ký hiện trường">
                Chưa có endpoint nhật ký — dữ liệu sẽ hiển thị khi API hỗ trợ.
              </EmptyState>
            </div>
          </>
        )}
      </div>

      {editOpen && project ? (
        <ProjectEditDialog
          id={project.id}
          open
          onClose={() => setEditOpen(false)}
          onUpdated={() => {
            setEditOpen(false);
            onChanged();
          }}
        />
      ) : null}
      {statusAction && project ? (
        <ProjectStatusDialog
          projectName={project.name}
          currentStatus={project.status}
          action={statusAction}
          submitting={statusLoading}
          serverMessage={statusMessage}
          onConfirm={(reason) => void handleStatusConfirm(reason)}
          onCancel={() => setStatusAction(null)}
        />
      ) : null}
    </aside>
  );
}
