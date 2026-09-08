'use client';

import * as React from 'react';
import { getWorkerCrews, type WorkerCrewMembership, type ApiError as WorkerApiError } from '@/lib/api/workers';
import {
  listCrews,
  listCrewMembers,
  addCrewMember,
  removeCrewMember,
  type Crew,
  type ApiError as CrewApiError,
} from '@/lib/api/crews';
import { canViewResourceDirectory, useSessionRoleCodes } from '@/lib/auth/roles';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { Input } from '@/components/ui/input/Input';
import { Select } from '@/components/ui/select/Select';
import { toast } from '@/components/ui/toast/Toaster';

type ApiError = WorkerApiError | CrewApiError;

function roleBadge(role: string): React.ReactNode {
  if (role === 'LEAD') {
    return <span className="bf-badge bf-badge-info">Trưởng nhóm</span>;
  }
  return <span className="bf-badge bf-badge-neutral">Thành viên</span>;
}

function crewStatusBadge(status: string): React.ReactNode {
  const tone = status === 'ACTIVE' ? 'bf-badge-ok' : 'bf-badge-busy';
  const label = status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng hoạt động';
  return <span className={`bf-badge ${tone}`}>{label}</span>;
}

function effectiveLabel(m: WorkerCrewMembership): string {
  return m.effectiveTo ? `${m.effectiveFrom} → ${m.effectiveTo}` : `${m.effectiveFrom} → đến nay`;
}

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * ORG-03/ORG-05/BR-06 (Worker ↔ Crew link) — section 'Đội thi công' trong
 * WorkerDetail: bảng memberships hiện tại (GET /workers/:id/crews, song song
 * detail) + 'Thêm vào đội' (ADMIN/PM, Ark Dialog: select đội ACTIVE chưa tham
 * gia; thành viên mới vào với vai trò Thành viên — D1, đổi Trưởng nhóm tại
 * trang đội) + 'Kết thúc' từng row (confirm + reason optional → soft-deactivate,
 * lịch sử giữ nguyên).
 */
export function WorkerCrews({ workerId, workerName }: { workerId: string; workerName: string }) {
  const canManage = canViewResourceDirectory(useSessionRoleCodes());
  const [memberships, setMemberships] = React.useState<WorkerCrewMembership[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWorkerCrews(workerId);
      setMemberships(data);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  React.useEffect(() => {
    void load();
  }, [load, retryKey]);

  function reload() {
    setRetryKey((k) => k + 1);
  }

  // Add dialog
  const [addOpen, setAddOpen] = React.useState(false);
  const [crews, setCrews] = React.useState<Crew[]>([]);
  const [crewsLoading, setCrewsLoading] = React.useState(false);
  const [crewId, setCrewId] = React.useState('');
  const [addPending, setAddPending] = React.useState(false);
  const [addFieldErrors, setAddFieldErrors] = React.useState<Record<string, string[]>>({});
  const [addGlobalError, setAddGlobalError] = React.useState<string | null>(null);

  function openAdd() {
    setAddOpen(true);
    setCrewId('');
    setAddFieldErrors({});
    setAddGlobalError(null);
    setCrewsLoading(true);
    listCrews({ status: 'ACTIVE', limit: 100, offset: 0 })
      .then((res) => setCrews(res.data))
      .catch(() => setCrews([]))
      .finally(() => setCrewsLoading(false));
  }

  const joinedIds = React.useMemo(() => new Set(memberships.map((m) => m.crewId)), [memberships]);
  const crewOptions = React.useMemo(
    () =>
      crews
        .filter((c) => !joinedIds.has(c.id))
        .map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
    [crews, joinedIds],
  );

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (addPending || !crewId) return;
    setAddPending(true);
    setAddFieldErrors({});
    setAddGlobalError(null);
    try {
      await addCrewMember(crewId, { userId: workerId });
      const hit = crews.find((c) => c.id === crewId);
      toast.success({ title: `Đã thêm ${workerName} vào đội ${hit ? `${hit.name} (${hit.code})` : ''}.`.trim() });
      setAddOpen(false);
      reload();
    } catch (err) {
      const e2 = err as CrewApiError;
      if (e2.code === 'MEMBER_DUPLICATE' || e2.status === 409) {
        setAddFieldErrors({ crewId: ['Công nhân đã là thành viên của đội này'] });
        setAddGlobalError(e2.message);
      } else if (e2.status === 404) {
        setAddGlobalError('Không tìm thấy đội hoặc công nhân (404) — danh sách đội có thể đã đổi, hãy đóng và mở lại.');
      } else if (e2.status === 403) {
        setAddGlobalError('Không có quyền — cần ADMIN hoặc PROJECT_MANAGER.');
      } else if (e2.fieldErrors && Object.keys(e2.fieldErrors).length > 0) {
        const fe: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(e2.fieldErrors)) {
          if (k !== '_global') fe[k === 'userId' ? 'crewId' : k] = v;
        }
        setAddFieldErrors(fe);
        setAddGlobalError(e2.message);
      } else if (e2.status === 401) {
        setAddGlobalError('Phiên hết hạn, vui lòng đăng nhập lại.');
      } else {
        setAddGlobalError(e2.message || 'Thêm vào đội thất bại');
      }
    } finally {
      setAddPending(false);
    }
  }

  // Remove confirm (Dialog) — reason optional, effectiveTo default today.
  const [confirming, setConfirming] = React.useState<WorkerCrewMembership | null>(null);
  const [removeEffectiveTo, setRemoveEffectiveTo] = React.useState('');
  const [removeReason, setRemoveReason] = React.useState('');
  const [removePending, setRemovePending] = React.useState(false);
  const [removeFieldError, setRemoveFieldError] = React.useState<string | null>(null);
  const [removeGlobalError, setRemoveGlobalError] = React.useState<string | null>(null);

  function openRemoveConfirm(m: WorkerCrewMembership) {
    setConfirming(m);
    setRemoveEffectiveTo(todayDateOnly());
    setRemoveReason('');
    setRemoveFieldError(null);
    setRemoveGlobalError(null);
  }

  async function handleRemove() {
    if (!confirming || removePending) return;
    setRemovePending(true);
    setRemoveFieldError(null);
    setRemoveGlobalError(null);
    try {
      // Membership item không mang member record id — tra qua roster đội
      // để lấy memberId cho DELETE /crews/:id/members/:memberId.
      const roster = await listCrewMembers(confirming.crewId);
      const hit = roster.data.find((m) => m.userId === workerId && m.isActive);
      if (!hit) {
        setRemoveGlobalError('Thành viên đã rời đội trước đó — không thay đổi gì thêm.');
        return;
      }
      await removeCrewMember(confirming.crewId, hit.id, {
        effectiveTo: removeEffectiveTo || null,
        reason: removeReason.trim() || null,
      });
      toast.success({ title: `Đã kết thúc ${workerName} tại đội ${confirming.crewName} — lịch sử giữ nguyên.` });
      setConfirming(null);
      reload();
    } catch (err) {
      const e2 = err as CrewApiError;
      if (e2.fieldErrors?.effectiveTo?.length) setRemoveFieldError(e2.fieldErrors.effectiveTo.join(' '));
      else if (e2.fieldErrors?.reason?.length) setRemoveFieldError(e2.fieldErrors.reason.join(' '));
      else if (e2.status === 401) setRemoveGlobalError('Phiên hết hạn, vui lòng đăng nhập lại.');
      else if (e2.status === 403) setRemoveGlobalError('Không có quyền — cần ADMIN hoặc PROJECT_MANAGER.');
      else setRemoveGlobalError(e2.message || 'Kết thúc thất bại');
    } finally {
      setRemovePending(false);
    }
  }

  return (
    <Card>
      <div className="bf-card-head">
        <span className="bf-card-title">Đội thi công</span>
        {canManage ? (
          <Button variant="primary" size="sm" onClick={openAdd}>
            Thêm vào đội
          </Button>
        ) : null}
      </div>

      {loading ? (
        <p aria-busy="true" style={{ margin: 0, color: 'var(--bf-muted)', fontSize: '0.9rem' }}>
          Đang tải đội thi công…
        </p>
      ) : error ? (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <Alert tone="error">{error.message || 'Không thể tải đội thi công'}</Alert>
          <div>
            <Button variant="secondary" size="sm" onClick={reload}>
              Thử lại
            </Button>
          </div>
        </div>
      ) : memberships.length === 0 ? (
        <EmptyState icon="👥" title="Chưa tham gia đội nào">
          Công nhân này hiện chưa thuộc đội thi công nào.
        </EmptyState>
      ) : (
        <div className="bf-table-wrap">
          <table className="bf-table">
            <thead>
              <tr>
                <th>Đội</th>
                <th>Vai trò</th>
                <th>Hiệu lực</th>
                <th>Trạng thái đội</th>
                {canManage ? <th style={{ textAlign: 'right' }}>Hành động</th> : null}
              </tr>
            </thead>
            <tbody>
              {memberships.map((m) => (
                <tr key={m.crewId}>
                  <td>
                    <a
                      href={`/crews/${m.crewId}`}
                      style={{ color: '#111827', fontWeight: 600, textDecoration: 'none' }}
                    >
                      {m.crewCode} — {m.crewName}
                    </a>
                  </td>
                  <td>{roleBadge(m.memberRole)}</td>
                  <td style={{ color: '#6b7280' }}>{effectiveLabel(m)}</td>
                  <td>{crewStatusBadge(m.crewStatus)}</td>
                  {canManage ? (
                    <td style={{ textAlign: 'right' }}>
                      <Button variant="secondary" size="sm" onClick={() => openRemoveConfirm(m)}>
                        Kết thúc
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !error && memberships.length > 0 ? (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--bf-muted)' }}>
          Kết thúc hiệu lực chỉ dừng phân công mới — lịch sử thành viên giữ nguyên.
        </p>
      ) : null}

      {addOpen ? (
        <Dialog title="Thêm vào đội" open onClose={() => (addPending ? null : setAddOpen(false))}>
          <form onSubmit={(e) => void handleAdd(e)} style={{ display: 'grid', gap: '0.75rem' }}>
            {addGlobalError && !addFieldErrors.crewId ? <Alert tone="error">{addGlobalError}</Alert> : null}
            <div className="bf-field">
              <Select
                id="worker-add-crew"
                label="Đội thi công"
                value={crewId}
                options={[
                  { value: '', label: crewsLoading ? 'Đang tải đội…' : '— Chọn đội đang hoạt động —', disabled: true },
                  ...crewOptions,
                ]}
                onChange={setCrewId}
                disabled={addPending || crewsLoading}
                aria-invalid={addFieldErrors.crewId ? true : undefined}
                aria-describedby={addFieldErrors.crewId ? 'worker-add-crew-error' : undefined}
              />
              {addFieldErrors.crewId ? (
                <p id="worker-add-crew-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                  {addFieldErrors.crewId.join(' ')}
                </p>
              ) : null}
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--bf-muted)' }}>
              Thành viên mới vào với vai trò Thành viên; Trưởng nhóm được đổi tại trang đội.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="primary" type="submit" disabled={addPending || !crewId}>
                {addPending ? 'Đang thêm…' : 'Thêm vào đội'}
              </Button>
              <Button variant="secondary" type="button" onClick={() => setAddOpen(false)} disabled={addPending}>
                Hủy
              </Button>
            </div>
          </form>
        </Dialog>
      ) : null}

      {confirming ? (
        <Dialog
          title={`Kết thúc ${workerName} tại đội ${confirming.crewName}?`}
          open
          onClose={() => (removePending ? null : setConfirming(null))}
        >
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--bf-muted)' }}>
              Kết thúc hiệu lực, lịch sử giữ nguyên.
            </p>
            <div className="bf-field" style={{ minWidth: 150 }}>
              <label className="bf-label" htmlFor="worker-crew-remove-effective-to">
                Ngày kết thúc
              </label>
              <Input
                id="worker-crew-remove-effective-to"
                type="date"
                value={removeEffectiveTo}
                min={confirming.effectiveFrom}
                onChange={(e) => setRemoveEffectiveTo(e.target.value)}
                aria-invalid={removeFieldError ? true : undefined}
                aria-describedby={removeFieldError ? 'worker-crew-remove-error' : undefined}
              />
            </div>
            <div className="bf-field">
              <label className="bf-label" htmlFor="worker-crew-remove-reason">
                Lý do (không bắt buộc)
              </label>
              <textarea
                id="worker-crew-remove-reason"
                className="bf-input"
                rows={2}
                maxLength={500}
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                placeholder="Ví dụ: điều chuyển sang đội khác…"
              />
            </div>
            {removeFieldError ? (
              <p id="worker-crew-remove-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: 0 }}>
                {removeFieldError}
              </p>
            ) : null}
            {removeGlobalError ? <Alert tone="error">{removeGlobalError}</Alert> : null}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="secondary" onClick={() => void handleRemove()} disabled={removePending}>
                {removePending ? 'Đang kết thúc…' : 'Xác nhận kết thúc'}
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(null)} disabled={removePending}>
                Hủy
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </Card>
  );
}
