'use client';

import * as React from 'react';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { closeJobBoard } from '@/lib/api/work-order-board';
import type { ApiError, WorkOrder, WorkOrderJobBoardState } from '@/lib/api/work-orders';
import { toast } from '@/components/ui/toast/Toaster';

export const JOB_BOARD_STATE_LABELS: Record<WorkOrderJobBoardState, string> = {
  AVAILABLE: 'Đang nhận việc',
  CLOSED: 'Đã đóng',
  EXPIRED: 'Hết hạn',
  ASSIGNED: 'Đã có người nhận',
  SCHEDULED: 'Chưa mở cửa sổ',
};

const JOB_BOARD_STATE_BADGES: Record<WorkOrderJobBoardState, string> = {
  AVAILABLE: 'bf-badge-ok',
  CLOSED: 'bf-badge-idle',
  EXPIRED: 'bf-badge-risk',
  ASSIGNED: 'bf-badge-info',
  SCHEDULED: 'bf-badge-busy',
};

/**
 * F011 — `state` lạ (ngoài enum — không kỳ vọng, phòng contract lệch):
 * fallback trung tính, không crash, không badge sai.
 */
function resolveBoardPresentation(rawState: unknown): { label: string; badge: string } {
  if (typeof rawState === 'string' && rawState in JOB_BOARD_STATE_LABELS) {
    const known = rawState as WorkOrderJobBoardState;
    return { label: JOB_BOARD_STATE_LABELS[known], badge: JOB_BOARD_STATE_BADGES[known] };
  }
  return { label: 'Không xác định', badge: 'bf-badge-idle' };
}

function formatDateTime(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString('vi-VN');
}

export interface WorkOrderJobBoardCardProps {
  workOrder: WorkOrder;
  /** Convenience gate phía client; server mới là lớp bảo mật thật. */
  canManage: boolean;
  /** Gọi sau mỗi thao tác thành công HOẶC khi bấm Tải lại sau 409 (parent re-fetch GET :id). */
  onRefresh: () => void;
  /** Mở dialog nhập cửa sổ (parent giữ state dialog). */
  onRequestOpen: () => void;
}

/**
 * JOB-SRS-004 (issue #44) — card Job Board trên /work-orders/:id.
 * Badge đọc từ `workOrder.jobBoard.state` (server-derived, không tự derive).
 * Nút gate `canManage` (WORKER/VIEWER ẩn nút; gọi API trực tiếp → Alert 403).
 * Đóng: confirm inline kèm note "việc đã phân công không bị hủy".
 * 409 WORK_ORDER_CONFLICT → Alert + nút Tải lại.
 */
export function WorkOrderJobBoardCard({ workOrder, canManage, onRefresh, onRequestOpen }: WorkOrderJobBoardCardProps) {
  const [confirmClose, setConfirmClose] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<ApiError | null>(null);

  const board = workOrder.jobBoard ?? null;
  const { label: stateLabel, badge: stateBadge } = resolveBoardPresentation(board?.state);
  const open = board?.open === true;
  const status = workOrder.status.toUpperCase();

  function openLabel(): string | null {
    if (open) return null;
    if (status === 'OPEN') return 'Mở lại Job Board';
    if (status === 'DRAFT' || status === 'READY') return 'Mở Job Board';
    return null;
  }

  async function handleClose() {
    setPending(true);
    setError(null);
    try {
      const res = await closeJobBoard(workOrder.id, { expectedVersion: workOrder.version });
      toast.success({ title: res.alreadyClosed ? 'Job Board đã đóng trước đó' : `Đã đóng Job Board ${workOrder.code}` });
      setConfirmClose(false);
      onRefresh();
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setPending(false);
    }
  }

  const label = openLabel();
  const conflict = error?.code === 'WORK_ORDER_CONFLICT' || error?.status === 409;
  const expired = board?.state === 'EXPIRED';

  return (
    <Card>
      <div className="bf-card-head">
        <span className="bf-card-title">Job Board</span>
        <span className={`bf-badge ${stateBadge}`}>{stateLabel}</span>
      </div>

      <dl className="bf-def-grid">
        <div>
          <dt>Trạng thái cửa sổ</dt>
          <dd>{board?.open ? `Mở (${formatDateTime(board.openFrom)} → ${board.openUntil ? formatDateTime(board.openUntil) : 'không hạn'})` : '—'}</dd>
        </div>
        {board?.hasActiveAssignment ? (
          <div>
            <dt>Phân công</dt>
            <dd>Đã có người nhận — đóng Job Board không hủy việc đã phân công</dd>
          </div>
        ) : null}
      </dl>

      {expired ? (
        <div style={{ marginTop: '0.75rem' }}>
          <Alert tone="error">Cửa sổ đã hết hạn — đóng rồi mở lại để đặt cửa sổ mới.</Alert>
        </div>
      ) : null}

      {error ? (
        <div style={{ marginTop: '0.75rem' }}>
          {error.code === 'WORK_ORDER_CONFLICT' ? (
            <Alert tone="error">
              Work order đã bị thay đổi — tải lại để lấy bản mới nhất rồi thử tiếp.
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                <Button variant="secondary" size="sm" onClick={onRefresh}>
                  Tải lại
                </Button>
              </div>
            </Alert>
          ) : error.code === 'JOB_BOARD_ALREADY_OPEN' ? (
            <Alert tone="error">
              Job Board đã được mở (cửa sổ đã đổi) — tải lại để xem trạng thái mới nhất.
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                <Button variant="secondary" size="sm" onClick={onRefresh}>
                  Tải lại
                </Button>
              </div>
            </Alert>
          ) : error.code === 'JOB_BOARD_HAS_ASSIGNEE' ? (
            <Alert tone="error">Work order đã có người nhận — không thể mở Job Board.</Alert>
          ) : error.status === 403 ? (
            <Alert tone="error">Không có quyền thao tác Job Board — cần quyền quản lý dự án (403)</Alert>
          ) : (
            <Alert tone="error">{error.message || 'Thao tác Job Board thất bại'}</Alert>
          )}
          {conflict && error.code !== 'WORK_ORDER_CONFLICT' && error.code !== 'JOB_BOARD_ALREADY_OPEN' ? (
            <div style={{ marginTop: '0.5rem' }}>
              <Button variant="secondary" size="sm" onClick={onRefresh}>
                Tải lại
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {canManage ? (
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          {label && !open ? (
            <Button variant="primary" onClick={onRequestOpen} disabled={pending} aria-busy={pending || undefined}>
              {label}
            </Button>
          ) : null}
          {open ? (
            confirmClose ? (
              <>
                <Alert tone="info">Đóng Job Board đưa work order về READY; việc đã phân công không bị hủy.</Alert>
                <Button variant="primary" onClick={() => void handleClose()} loading={pending}>
                  Xác nhận đóng
                </Button>
                <Button variant="secondary" onClick={() => setConfirmClose(false)} disabled={pending}>
                  Hủy
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => { setError(null); setConfirmClose(true); }} disabled={pending}>
                Đóng Job Board
              </Button>
            )
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
