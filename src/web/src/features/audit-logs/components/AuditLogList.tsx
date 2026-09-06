'use client';

/**
 * AuditLogList (IAM-SRS-008, GitHub issue #23): bảng nhật ký thao tác cho admin.
 * State matrix clone theo AdminUserList: loading / 401 / 403 / lỗi khác / empty,
 * draft vs applied filters ('Lọc' mới áp dụng và reset offset về 0),
 * deep-link ?action=&result=&correlationId=&entityType=&entityId= qua useSearchParams
 * (page bọc Suspense). entityType/entityId phục vụ deep-link từ StatusTimeline
 * (ORG-SRS-004): API lọc exact-match, bỏ param action prefix gây 0 dòng.
 */
import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { listAuditLogs, type AuditLog, type AuditLogError } from '@/lib/api/audit-logs';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { Input } from '@/components/ui/input/Input';
import { StatusBadge } from '@/components/ui/badge/StatusBadge';

const PAGE_SIZE = 20;

const KNOWN_ACTIONS = [
  'AUTH_LOGIN_SUCCESS',
  'AUTH_LOGIN_FAILED',
  'AUTH_LOGOUT',
  'IAM_USER_LOCKED',
  'IAM_USER_UNLOCKED',
  'IAM_USER_DEACTIVATED',
  'IAM_USER_REACTIVATED',
  'IAM_ROLE_ASSIGNED',
  'IAM_PASSWORD_CHANGED',
  'IAM_PASSWORD_RESET_COMPLETED',
  // ORG-SRS-001/002/003/004: lifecycle + CRUD worker/contractor/trade (E2E ORG-SRS-004 —
  // dropdown trước đây thiếu option cho các action mới, user không chọn tay được).
  'ORG_WORKER_CREATED',
  'ORG_WORKER_UPDATED',
  'ORG_WORKER_SUSPENDED',
  'ORG_WORKER_REACTIVATED',
  'ORG_WORKER_TERMINATED',
  'ORG_CONTRACTOR_CREATED',
  'ORG_CONTRACTOR_UPDATED',
  'ORG_CONTRACTOR_SUSPENDED',
  'ORG_CONTRACTOR_REACTIVATED',
  'ORG_CONTRACTOR_TERMINATED',
  'ORG_CONTRACTOR_STATUS_CHANGED',
  'ORG_TRADE_CREATED',
  'ORG_TRADE_UPDATED',
  'ORG_TRADE_STATUS_CHANGED',
] as const;

// Lookup O(1) cho Finding 5: action deep-link ngoài danh sách → thêm option bổ sung.
const KNOWN_ACTION_SET: ReadonlySet<string> = new Set<string>(KNOWN_ACTIONS);

// Entity types thật trong DB (SELECT DISTINCT entity_type FROM audit_logs).
const KNOWN_ENTITY_TYPES = ['WORKER', 'CONTRACTOR', 'TRADE', 'USER'] as const;

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'medium' });
}

function shortenId(v: string | null): string | null {
  if (!v) return null;
  return v.length > 12 ? `${v.slice(0, 8)}…` : v;
}

function entityLabel(log: AuditLog): string {
  const id = shortenId(log.entityId);
  if (!log.entityType && !id) return '—';
  return [log.entityType, id].filter(Boolean).join(' ');
}

function truncate(v: string, max: number): string {
  return v.length > max ? `${v.slice(0, max)}…` : v;
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <span className="bf-field-error">{messages[0]}</span>;
}

export function AuditLogList() {
  const searchParams = useSearchParams();
  const initialAction = searchParams.get('action') ?? '';
  const initialResult = searchParams.get('result') ?? '';
  const initialCorrelationId = searchParams.get('correlationId') ?? '';
  const initialEntityType = searchParams.get('entityType') ?? '';
  const initialEntityId = searchParams.get('entityId') ?? '';

  // Applied filters — thay đổi sẽ kích hoạt load().
  const [action, setAction] = React.useState(initialAction);
  const [result, setResult] = React.useState(initialResult);
  const [correlationId, setCorrelationId] = React.useState(initialCorrelationId);
  const [entityType, setEntityType] = React.useState(initialEntityType);
  const [entityId, setEntityId] = React.useState(initialEntityId);
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [offset, setOffset] = React.useState(0);
  const [pageLimit, setPageLimit] = React.useState(PAGE_SIZE);

  // Draft filters — chỉ áp dụng khi bấm 'Lọc'.
  const [actionInput, setActionInput] = React.useState(initialAction);
  const [resultInput, setResultInput] = React.useState(initialResult);
  const [correlationIdInput, setCorrelationIdInput] = React.useState(initialCorrelationId);
  const [entityTypeInput, setEntityTypeInput] = React.useState(initialEntityType);
  const [entityIdInput, setEntityIdInput] = React.useState(initialEntityId);
  const [fromInput, setFromInput] = React.useState('');
  const [toInput, setToInput] = React.useState('');

  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<AuditLogError | null>(null);

  // Guard chống race: chỉ response của request mới nhất (seq trùng loadSeqRef.current)
  // mới được setState — response cũ về sau phải bị bỏ qua hoàn toàn.
  const loadSeqRef = React.useRef(0);

  const load = React.useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await listAuditLogs({
        action: action || undefined,
        result: result || undefined,
        correlationId: correlationId || undefined,
        entityType: entityType || undefined,
        entityId: entityId || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      if (seq !== loadSeqRef.current) return;
      setLogs(res.data);
      setTotal(res.total);
      setPageLimit(res.limit > 0 ? res.limit : PAGE_SIZE);
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      setError(e as AuditLogError);
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  }, [action, result, correlationId, entityType, entityId, from, to, offset]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function handleApplyFilters() {
    setAction(actionInput);
    setResult(resultInput);
    setCorrelationId(correlationIdInput);
    setEntityType(entityTypeInput);
    setEntityId(entityIdInput);
    setFrom(fromInput);
    setTo(toInput);
    setOffset(0);
  }

  function handleRetry() {
    void load();
  }

  function handlePrevPage() {
    setOffset(Math.max(0, offset - pageLimit));
  }

  function handleNextPage() {
    setOffset(offset + pageLimit);
  }

  if (loading) {
    return (
      <Card>
        <p aria-busy="true">Đang tải…</p>
      </Card>
    );
  }

  if (error && error.status === 401) {
    return (
      <Card>
        <Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại (401)</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <a href="/login">Đến trang đăng nhập</a>
        </div>
      </Card>
    );
  }

  if (error && error.status === 403) {
    return (
      <Card>
        <Alert tone="info">Không có quyền truy cập — cần vai trò ADMIN (403)</Alert>
        <EmptyState title="Bạn không thể xem nhật ký thao tác">
          Tài khoản hiện tại không đủ quyền. Hãy liên hệ quản trị viên hoặc đăng nhập bằng tài
          khoản quản trị để tiếp tục.
        </EmptyState>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Button variant="secondary" onClick={handleRetry}>Thử lại</Button>
        </div>
      </Card>
    );
  }

  // Lỗi validate (400): giữ trang dùng được — hiện lỗi nhỏ dưới đúng filter, không dựng error card.
  const fieldErrors = error?.fieldErrors;
  const hasFieldErrors = Boolean(fieldErrors && Object.keys(fieldErrors).length > 0);

  if (error && !hasFieldErrors) {
    return (
      <Card>
        <Alert tone="error">{error.message || 'Không thể tải nhật ký thao tác'}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={handleRetry}>Thử lại</Button>
        </div>
      </Card>
    );
  }

  const page = Math.floor(offset / pageLimit) + 1;
  const pageCount = Math.max(1, Math.ceil(total / pageLimit));
  const hasPrev = offset > 0;
  const hasNext = offset + logs.length < total;
  // Deep-link/filter action ngoài KNOWN_ACTIONS → prepend option để select hiển thị đúng
  // giá trị thay vì rơi về rỗng (Finding 5).
  const extraAction = actionInput && !KNOWN_ACTION_SET.has(actionInput) ? actionInput : null;
  const extraEntityType =
    entityTypeInput &&
    !(KNOWN_ENTITY_TYPES as readonly string[]).includes(entityTypeInput)
      ? entityTypeInput
      : null;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <div className="bf-field" style={{ flex: '1 1 220px' }}>
            <label className="bf-label" htmlFor="audit-action">Hành động</label>
            <select
              id="audit-action"
              className="bf-input"
              value={actionInput}
              onChange={(e) => setActionInput(e.target.value)}
            >
              <option value="">Tất cả</option>
              {extraAction ? <option value={extraAction}>{extraAction}</option> : null}
              {KNOWN_ACTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <FieldError messages={fieldErrors?.action} />
          </div>
          <div className="bf-field" style={{ minWidth: 150 }}>
            <label className="bf-label" htmlFor="audit-result">Kết quả</label>
            <select
              id="audit-result"
              className="bf-input"
              value={resultInput}
              onChange={(e) => setResultInput(e.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILED">FAILED</option>
            </select>
            <FieldError messages={fieldErrors?.result} />
          </div>
          <div className="bf-field" style={{ flex: '1 1 220px' }}>
            <label className="bf-label" htmlFor="audit-correlation">Correlation ID</label>
            <Input
              id="audit-correlation"
              placeholder="uuid tương quan…"
              value={correlationIdInput}
              onChange={(e) => setCorrelationIdInput(e.target.value)}
            />
            <FieldError messages={fieldErrors?.correlationId} />
          </div>
          <div className="bf-field" style={{ minWidth: 150 }}>
            <label className="bf-label" htmlFor="audit-entity-type">Loại đối tượng</label>
            <select
              id="audit-entity-type"
              className="bf-input"
              value={entityTypeInput}
              onChange={(e) => setEntityTypeInput(e.target.value)}
            >
              <option value="">Tất cả</option>
              {extraEntityType ? <option value={extraEntityType}>{extraEntityType}</option> : null}
              {KNOWN_ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <FieldError messages={fieldErrors?.entityType} />
          </div>
          <div className="bf-field" style={{ flex: '1 1 220px' }}>
            <label className="bf-label" htmlFor="audit-entity-id">ID đối tượng</label>
            <Input
              id="audit-entity-id"
              placeholder="uuid đối tượng…"
              value={entityIdInput}
              onChange={(e) => setEntityIdInput(e.target.value)}
            />
            <FieldError messages={fieldErrors?.entityId} />
          </div>
          <div className="bf-field" style={{ minWidth: 150 }}>
            <label className="bf-label" htmlFor="audit-from">Từ ngày</label>
            <Input
              id="audit-from"
              type="date"
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
            />
            <FieldError messages={fieldErrors?.from} />
          </div>
          <div className="bf-field" style={{ minWidth: 150 }}>
            <label className="bf-label" htmlFor="audit-to">Đến ngày</label>
            <Input
              id="audit-to"
              type="date"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
            />
            <FieldError messages={fieldErrors?.to} />
          </div>
          <Button variant="secondary" onClick={handleApplyFilters}>Lọc</Button>
        </div>
        {hasFieldErrors && fieldErrors?._global?.length ? (
          <p className="bf-field-error" style={{ marginTop: '0.5rem' }}>{fieldErrors._global.join(' ')}</p>
        ) : null}
        <p className="bf-card-meta" style={{ marginTop: '0.75rem' }}>
          Tổng: {total} bản ghi · Dữ liệu trước/sau thay đổi có thể chứa thông tin nhạy cảm nên không hiển thị.
        </p>
      </Card>

      {logs.length === 0 ? (
        <Card>
          <EmptyState title="Chưa có bản ghi nào phù hợp bộ lọc">
            Thử thay đổi khoảng thời gian, hành động hoặc kết quả để xem thêm bản ghi.
          </EmptyState>
        </Card>
      ) : (
        <Card>
          <div className="bf-table-wrap">
            <table className="bf-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Hành động</th>
                  <th>Đối tượng</th>
                  <th>Người thực hiện</th>
                  <th>Kết quả</th>
                  <th>Lý do</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  // beforeData/afterData có thể chứa secrets (mật khẩu, token) —
                  // chủ ý KHÔNG hiển thị hai field này ở bất kỳ đâu trên UI (IAM-SRS-008).
                  return (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(log.createdAt)}</td>
                      <td style={{ fontWeight: 600 }}>{log.action}</td>
                      <td>{entityLabel(log)}</td>
                      <td>{log.actorUserId ? shortenId(log.actorUserId) : 'Hệ thống'}</td>
                      <td><StatusBadge status={log.result} /></td>
                      <td>
                        {log.reason || log.correlationId ? (
                          <div style={{ maxWidth: 280, overflowWrap: 'anywhere' }}>
                            {log.reason ? <div>{truncate(log.reason, 120)}</div> : null}
                            {log.correlationId ? (
                              <div className="bf-card-meta">{truncate(log.correlationId, 36)}</div>
                            ) : null}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bf-pagination">
            <Button variant="secondary" disabled={!hasPrev} onClick={handlePrevPage}>Trang trước</Button>
            <span className="bf-card-meta">
              Trang {page} / {pageCount} (tổng {total})
            </span>
            <Button variant="secondary" disabled={!hasNext} onClick={handleNextPage}>Trang sau</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
