'use client';

import * as React from 'react';
import {
  listCrewMembers,
  addCrewMember,
  removeCrewMember,
  type CrewMember,
  type ApiError,
} from '@/lib/api/crews';
import { listWorkers, type Worker } from '@/lib/api/workers';
import { RESOURCE_REASON_MAX_LENGTH } from '@/features/resources/components/ResourceStatusDialog';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { Input } from '@/components/ui/input/Input';
import { Select } from '@/components/ui/select/Select';
import { toast } from '@/components/ui/toast/Toaster';

interface Props {
  crewId: string;
  crewStatus: string;
  onChanged?: () => void;
}

function workerLabel(w: Worker): string {
  return `${w.fullName} · ${w.employeeCode ?? w.id.slice(0, 8)}`;
}

function memberDisplayName(m: CrewMember, workerNames: Map<string, string>): string {
  if (m.userName) return `${m.userName} · ${m.userCode ?? m.userId.slice(0, 8)}`;
  const hit = workerNames.get(m.userId);
  if (hit) return hit;
  return `${m.userId.slice(0, 8)}…`;
}

function roleLabel(role: string): string {
  return role === 'LEAD' ? 'TRƯỞNG NHÓM' : 'THÀNH VIÊN';
}

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

function effectivePeriod(m: CrewMember): string {
  return m.effectiveTo ? `${m.effectiveFrom} → ${m.effectiveTo}` : `${m.effectiveFrom} → nay`;
}

/**
 * ORG-SRS-007 (issue #30) — quản lý thành viên đội (role MEMBER).
 * LEAD chỉ đọc ở đây; đổi trưởng nhóm qua form sửa hồ sơ đội (D1).
 * - Card 'Thành viên hiện tại': header title trái + nút 'Thêm thành viên' phải;
 *   body bảng .bf-table (Công nhân link /workers/:id, Vai trò, Hiệu lực, Hành động).
 *   Form thêm nằm trong Ark Dialog (Tìm công nhân + Công nhân + Ngày hiệu lực
 *   + 'Thêm vào đội'), lỗi per-field giữ nguyên.
 *   API POST chỉ nhận { userId, effectiveFrom? } (theo CreateCrewMemberDto thực tế).
 * - Card 'Lịch sử thành viên' (riêng, dưới): checkbox 'Xem toàn bộ lịch sử' +
 *   'Danh sách tại ngày' + bảng kết quả; mặc định thu gọn khi trống.
 * - Xóa mềm từng MEMBER active: confirm inline + effectiveTo (default today,
 *   min = effectiveFrom) + reason optional (max 500, counter).
 */
export function CrewMembers({ crewId, crewStatus, onChanged }: Props) {
  const [members, setMembers] = React.useState<CrewMember[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);

  const [showHistory, setShowHistory] = React.useState(false);
  const [at, setAt] = React.useState('');

  const [workerNames, setWorkerNames] = React.useState<Map<string, string>>(new Map());

  // Add form (Ark Dialog, mở từ nút 'Thêm thành viên' ở card hiện tại).
  const [addOpen, setAddOpen] = React.useState(false);
  const [workers, setWorkers] = React.useState<Worker[]>([]);
  const [userId, setUserId] = React.useState('');
  const [userSearch, setUserSearch] = React.useState('');
  const [effectiveFrom, setEffectiveFrom] = React.useState('');
  const [addPending, setAddPending] = React.useState(false);
  const [addFieldErrors, setAddFieldErrors] = React.useState<Record<string, string[]>>({});
  const [addGlobalError, setAddGlobalError] = React.useState<string | null>(null);
  const [addSuccess, setAddSuccess] = React.useState<string | null>(null);
  const [addWarning, setAddWarning] = React.useState<string | null>(null);

  // Remove confirm (per-row inline) — pending theo row (F11), chỉ row đang
  // xóa + dialog của nó bị disable.
  const [confirmMemberId, setConfirmMemberId] = React.useState<string | null>(null);
  const [removeEffectiveTo, setRemoveEffectiveTo] = React.useState('');
  const [removeReason, setRemoveReason] = React.useState('');
  const [removePendingId, setRemovePendingId] = React.useState<string | null>(null);
  const [removeFieldError, setRemoveFieldError] = React.useState<string | null>(null);
  const [removeGlobalError, setRemoveGlobalError] = React.useState<string | null>(null);
  const [removeNotice, setRemoveNotice] = React.useState<string | null>(null);
  const [removeSuccess, setRemoveSuccess] = React.useState<string | null>(null);

  const isCrewActive = crewStatus === 'ACTIVE';

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // `at` ưu tiên hơn includeInactive (point-in-time roster).
      const params = at.trim()
        ? { at: at.trim() }
        : showHistory
          ? { includeInactive: true }
          : {};
      const res = await listCrewMembers(crewId, params);
      setMembers(res.data);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [crewId, showHistory, at]);

  React.useEffect(() => {
    void load();
  }, [load, retryKey]);

  function reloadMembers() {
    setRetryKey((k) => k + 1);
  }

  // Worker ACTIVE cho select thêm + fallback tra tên (pattern CrewForm leader selector).
  React.useEffect(() => {
    let cancelled = false;
    async function loadWorkers() {
      try {
        const res = await listWorkers({ status: 'ACTIVE', limit: 100, offset: 0 });
        if (cancelled) return;
        setWorkers(res.data);
        setWorkerNames(new Map(res.data.map((w) => [w.id, workerLabel(w)])));
      } catch {
        if (!cancelled) {
          setWorkers([]);
          setWorkerNames(new Map());
        }
      }
    }
    void loadWorkers();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredWorkers = React.useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter(
      (w) =>
        w.fullName.toLowerCase().includes(q) ||
        (w.employeeCode ?? '').toLowerCase().includes(q) ||
        w.email.toLowerCase().includes(q),
    );
  }, [workers, userSearch]);

  const activeMembers = React.useMemo(() => members.filter((m) => m.isActive), [members]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (addPending) return;
    setAddPending(true);
    setAddFieldErrors({});
    setAddGlobalError(null);
    setAddSuccess(null);
    setAddWarning(null);
    try {
      const res = await addCrewMember(crewId, {
        userId,
        effectiveFrom: effectiveFrom || null,
      });
      const name = memberDisplayName(res, workerNames);
      setAddSuccess(`Đã thêm ${name} vào đội.`);
      toast.success({ title: `Đã thêm ${name} vào đội.` });
      if (res.warning?.code === 'MEMBER_IN_OTHER_CREW') {
        const others = res.warning.otherCrews.map((c) => `${c.crewName} (${c.crewCode})`).join(', ');
        setAddWarning(
          others
            ? `Thành viên đang thuộc đội khác: ${others} — vẫn thêm thành công, cần điều phối lịch làm việc.`
            : 'Thành viên đang thuộc đội khác — vẫn thêm thành công, cần điều phối lịch làm việc.',
        );
      }
      setUserId('');
      setUserSearch('');
      setEffectiveFrom('');
      reloadMembers();
      onChanged?.();
    } catch (err) {
      const e2 = err as ApiError;
      if (e2.code === 'MEMBER_DUPLICATE') {
        setAddFieldErrors({ userId: ['Thành viên đã trong đội'] });
        setAddGlobalError(e2.message);
      } else if (e2.code === 'CREW_INACTIVE') {
        setAddGlobalError('Đội đang không hoạt động nên không thể thêm thành viên.');
      } else if (e2.code === 'USER_NOT_FOUND' || e2.code === 'USER_INACTIVE') {
        setAddFieldErrors({ userId: [e2.message] });
      } else if (e2.fieldErrors && Object.keys(e2.fieldErrors).length > 0) {
        const fe: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(e2.fieldErrors)) {
          if (k !== '_global') fe[k] = v;
        }
        setAddFieldErrors(fe);
        setAddGlobalError(e2.message);
      } else if (e2.status === 401) {
        setAddGlobalError('Phiên hết hạn, vui lòng đăng nhập lại.');
      } else if (e2.status === 403) {
        setAddGlobalError('Không có quyền — cần ADMIN hoặc PROJECT_MANAGER.');
      } else {
        setAddGlobalError(e2.message || 'Thêm thành viên thất bại');
      }
    } finally {
      setAddPending(false);
    }
  }

  function openAdd() {
    setAddFieldErrors({});
    setAddGlobalError(null);
    setAddSuccess(null);
    setAddWarning(null);
    setAddOpen(true);
  }

  function openRemoveConfirm(m: CrewMember) {
    setConfirmMemberId(m.id);
    setRemoveEffectiveTo(todayDateOnly());
    setRemoveReason('');
    setRemoveFieldError(null);
    setRemoveGlobalError(null);
    setRemoveNotice(null);
    setRemoveSuccess(null);
  }

  async function handleRemove(m: CrewMember) {
    if (removePendingId) return;
    setRemovePendingId(m.id);
    setRemoveFieldError(null);
    setRemoveGlobalError(null);
    setRemoveNotice(null);
    setRemoveSuccess(null);
    try {
      const res = await removeCrewMember(crewId, m.id, {
        effectiveTo: removeEffectiveTo || null,
        reason: removeReason.trim() || null,
      });
      const name = memberDisplayName(res, workerNames);
      if (res.alreadyRemoved) {
        setRemoveNotice(`${name} đã rời đội trước đó — không thay đổi gì thêm.`);
      } else {
        setRemoveSuccess(`Đã xóa ${name} khỏi đội — lịch sử thành viên vẫn được giữ.`);
      }
      setConfirmMemberId(null);
      reloadMembers();
      onChanged?.();
    } catch (err) {
      const e2 = err as ApiError;
      if (e2.fieldErrors?.effectiveTo?.length) setRemoveFieldError(e2.fieldErrors.effectiveTo.join(' '));
      else if (e2.fieldErrors?.reason?.length) setRemoveFieldError(e2.fieldErrors.reason.join(' '));
      else if (e2.status === 401) setRemoveGlobalError('Phiên hết hạn, vui lòng đăng nhập lại.');
      else if (e2.status === 403) setRemoveGlobalError('Không có quyền — cần ADMIN hoặc PROJECT_MANAGER.');
      else setRemoveGlobalError(e2.message || 'Xóa thành viên thất bại');
    } finally {
      setRemovePendingId(null);
    }
  }

  function renderListError() {
    if (!error) return null;
    if (error.status === 401) {
      return (
        <Card>
          <Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại (401)</Alert>
          <div style={{ marginTop: '0.75rem' }}>
            <a href="/login">Đến trang đăng nhập</a>
          </div>
        </Card>
      );
    }
    if (error.status === 403) {
      return (
        <Card>
          <Alert tone="error">Không có quyền truy cập — cần ADMIN hoặc PROJECT_MANAGER (403)</Alert>
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={reloadMembers}>
              Thử lại
            </Button>
          </div>
        </Card>
      );
    }
    return (
      <Card>
        <Alert tone="error">{error.message || 'Không thể tải danh sách thành viên'}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={reloadMembers}>
            Thử lại
          </Button>
        </div>
      </Card>
    );
  }

  const confirming = confirmMemberId ? members.find((m) => m.id === confirmMemberId) ?? null : null;

  const historyVisible = showHistory || at.trim() !== '';

  function renderMemberTable(rows: CrewMember[]) {
    return (
      <div className="bf-table-wrap">
        <table className="bf-table">
          <thead>
            <tr>
              <th>Công nhân</th>
              <th>Vai trò</th>
              <th>Hiệu lực</th>
              <th style={{ textAlign: 'right' }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>
                  <a
                    href={`/workers/${m.userId}`}
                    style={{ color: '#111827', fontWeight: 600, textDecoration: 'none' }}
                  >
                    {memberDisplayName(m, workerNames)}
                  </a>{' '}
                  {!m.isActive ? (
                    <span className="bf-badge-neutral" style={{ fontSize: '0.75rem' }}>
                      Đã rời
                    </span>
                  ) : null}
                </td>
                <td>
                  <span
                    className={m.memberRole === 'LEAD' ? 'bf-badge-info' : 'bf-badge-neutral'}
                    style={{ fontWeight: 500, fontSize: '0.75rem' }}
                  >
                    {roleLabel(m.memberRole)}
                  </span>
                  {m.memberRole === 'LEAD' ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--bf-muted)', marginTop: '0.2rem' }}>
                      Đổi trưởng nhóm qua form sửa hồ sơ đội.
                    </div>
                  ) : null}
                </td>
                <td style={{ fontSize: '0.85rem', color: 'var(--bf-muted)' }}>
                  Hiệu lực: {effectivePeriod(m)} · Thêm ngày{' '}
                  {new Date(m.createdAt).toLocaleDateString('vi-VN')}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {m.isActive && m.memberRole !== 'LEAD' ? (
                    <Button variant="secondary" size="sm" onClick={() => openRemoveConfirm(m)} disabled={removePendingId === m.id}>
                      Xóa khỏi đội
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card>
        <div className="bf-card-head">
          <span className="bf-card-title">Thành viên hiện tại</span>
          <Button variant="primary" size="sm" onClick={openAdd}>
            Thêm thành viên
          </Button>
        </div>

        {removeNotice ? <Alert tone="info">{removeNotice}</Alert> : null}
        {removeSuccess ? <Alert tone="success">{removeSuccess}</Alert> : null}

        {loading ? (
          <p aria-busy="true">Đang tải danh sách thành viên…</p>
        ) : (
          renderListError() ??
          (activeMembers.length === 0 ? (
            <EmptyState title="Chưa có thành viên — thêm thành viên đầu tiên">
              Bấm nút Thêm thành viên ở trên để chọn công nhân đang hoạt động vào đội.
            </EmptyState>
          ) : (
            renderMemberTable(activeMembers)
          ))
        )}

      {confirming ? (
        <div
          role="dialog"
          aria-label={`Xác nhận xóa ${memberDisplayName(confirming, workerNames)} khỏi đội`}
          style={{
            border: '1px solid var(--bf-line)',
            borderRadius: '0.5rem',
            padding: '0.75rem',
            display: 'grid',
            gap: '0.5rem',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>
            Xóa {memberDisplayName(confirming, workerNames)} khỏi đội?
          </p>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--bf-muted)' }}>
            Xóa mềm — lịch sử thành viên vẫn được giữ, chỉ kết thúc hiệu lực.
          </p>
          <div className="bf-field" style={{ minWidth: 150 }}>
            <label className="bf-label" htmlFor="member-remove-effective-to">
              Ngày kết thúc
            </label>
            <Input
              id="member-remove-effective-to"
              type="date"
              value={removeEffectiveTo}
              min={confirming.effectiveFrom}
              onChange={(e) => setRemoveEffectiveTo(e.target.value)}
              aria-invalid={removeFieldError ? true : undefined}
              aria-describedby={removeFieldError ? 'member-remove-error' : undefined}
            />
          </div>
          <div className="bf-field">
            <label className="bf-label" htmlFor="member-remove-reason">
              Lý do (không bắt buộc)
            </label>
            <textarea
              id="member-remove-reason"
              className="bf-input"
              rows={2}
              maxLength={RESOURCE_REASON_MAX_LENGTH}
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
              placeholder="Ví dụ: điều chuyển sang đội khác…"
              aria-describedby="member-remove-reason-count"
            />
            <p id="member-remove-reason-count" style={{ fontSize: '0.8rem', color: 'var(--bf-muted)', margin: '0.25rem 0 0' }}>
              {removeReason.length}/{RESOURCE_REASON_MAX_LENGTH} ký tự · lý do được lưu cùng nhật ký thao tác
            </p>
          </div>
          {removeFieldError ? (
            <p id="member-remove-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: 0 }}>
              {removeFieldError}
            </p>
          ) : null}
          {removeGlobalError ? <Alert tone="error">{removeGlobalError}</Alert> : null}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="secondary" onClick={() => void handleRemove(confirming)} disabled={removePendingId !== null}>
              {removePendingId ? 'Đang xóa…' : 'Xác nhận xóa'}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmMemberId(null)} disabled={removePendingId !== null}>
              Hủy
            </Button>
          </div>
        </div>
      ) : null}
      </Card>

      {addOpen ? (
        <Dialog title="Thêm thành viên" open onClose={() => (addPending ? null : setAddOpen(false))}>
          <form onSubmit={(e) => void handleAdd(e)} style={{ display: 'grid', gap: '0.75rem' }}>
        {!isCrewActive ? (
          <Alert tone="info">Đội đang không hoạt động nên không thể thêm thành viên.</Alert>
        ) : null}
        {addWarning ? <Alert tone="info">{addWarning}</Alert> : null}
        {addSuccess ? <Alert tone="success">{addSuccess}</Alert> : null}
        {addGlobalError && !addFieldErrors.userId ? <Alert tone="error">{addGlobalError}</Alert> : null}
        <div className="bf-field">
          <label className="bf-label" htmlFor="member-add-search">
            Tìm công nhân
          </label>
          <Input
            id="member-add-search"
            placeholder="Tên, mã NV, email…"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            disabled={!isCrewActive || addPending}
          />
        </div>
        <div className="bf-field">
          <Select
            id="member-add-user"
            label="Công nhân"
            value={userId}
            options={[
              { value: '', label: '— Chọn công nhân đang hoạt động —' },
              ...filteredWorkers.map((w) => ({ value: w.id, label: workerLabel(w) })),
            ]}
            onChange={setUserId}
            disabled={!isCrewActive || addPending}
            aria-invalid={addFieldErrors.userId ? true : undefined}
            aria-describedby={addFieldErrors.userId ? 'member-add-user-error' : undefined}
          />
          {addFieldErrors.userId ? (
            <p id="member-add-user-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
              {addFieldErrors.userId.join(' ')}
            </p>
          ) : null}
        </div>
        <div className="bf-field" style={{ minWidth: 150 }}>
          <label className="bf-label" htmlFor="member-add-effective-from">
            Ngày hiệu lực (không bắt buộc)
          </label>
          <Input
            id="member-add-effective-from"
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            disabled={!isCrewActive || addPending}
            aria-invalid={addFieldErrors.effectiveFrom ? true : undefined}
            aria-describedby={addFieldErrors.effectiveFrom ? 'member-add-effective-from-error' : undefined}
          />
          {addFieldErrors.effectiveFrom ? (
            <p id="member-add-effective-from-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
              {addFieldErrors.effectiveFrom.join(' ')}
            </p>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="primary" type="submit" disabled={!isCrewActive || addPending || !userId}>
            {addPending ? 'Đang thêm…' : 'Thêm vào đội'}
          </Button>
          <Button variant="secondary" type="button" onClick={() => setAddOpen(false)} disabled={addPending}>
            Hủy
          </Button>
        </div>
        </form>
        </Dialog>
      ) : null}

      <Card>
        <div className="bf-card-head">
          <span className="bf-card-title">Lịch sử thành viên</span>
        </div>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={showHistory}
              onChange={(e) => setShowHistory(e.target.checked)}
            />
            Xem toàn bộ lịch sử (kể cả thành viên đã rời)
          </label>
          <div className="bf-field" style={{ minWidth: 150, maxWidth: 240 }}>
            <label className="bf-label" htmlFor="member-history-at">
              Danh sách tại ngày
            </label>
            <Input
              id="member-history-at"
              type="date"
              value={at}
              onChange={(e) => setAt(e.target.value)}
              placeholder="YYYY-MM-DD"
            />
          </div>
          {at.trim() ? (
            <div>
              <Button variant="secondary" onClick={() => setAt('')}>
                Xóa mốc thời gian
              </Button>
            </div>
          ) : null}
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          {historyVisible ? (
            loading ? (
              <p aria-busy="true" style={{ margin: 0 }}>Đang tải lịch sử thành viên…</p>
            ) : members.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--bf-muted)' }}>
                Không có bản ghi thành viên cho phạm vi đang xem.
              </p>
            ) : (
              renderMemberTable(members)
            )
          ) : (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--bf-muted)' }}>
              Lịch sử đang thu gọn — bật Xem toàn bộ lịch sử hoặc chọn Danh sách tại ngày để tra cứu.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
