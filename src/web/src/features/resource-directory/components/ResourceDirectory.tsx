'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { listWorkers, type ApiError as WorkerApiError, type Worker } from '@/lib/api/workers';
import { listContractors, type ApiError as ContractorApiError, type Contractor } from '@/lib/api/contractors';
import { listCrews, type ApiError as CrewApiError, type Crew } from '@/lib/api/crews';
import { listTrades, type Trade } from '@/lib/api/trades';
import { useCanViewResourceDirectory } from '@/lib/auth/roles';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { Input } from '@/components/ui/input/Input';
import { StatusBadge } from '@/components/ui/badge/StatusBadge';

type ApiError = WorkerApiError | ContractorApiError | CrewApiError;
type Tab = 'workers' | 'contractors' | 'crews';

const PAGE_SIZE = 20;

const WORKER_STATUSES = [
  { value: '', label: 'Tất cả' },
  { value: 'ACTIVE', label: 'Hoạt động' },
  { value: 'INACTIVE', label: 'Ngừng hoạt động' },
  { value: 'LOCKED', label: 'Bị khóa' },
];

const CONTRACTOR_STATUSES = [
  { value: '', label: 'Tất cả' },
  { value: 'ACTIVE', label: 'Hoạt động' },
  { value: 'INACTIVE', label: 'Ngừng hoạt động' },
];

const SORTS = [
  { value: 'createdAt', label: 'Mới nhất' },
  { value: 'name', label: 'Tên' },
];

const ORDERS = [
  { value: 'desc', label: 'Giảm dần' },
  { value: 'asc', label: 'Tăng dần' },
];

const SKILLS = [
  { value: '', label: 'Mọi cấp độ' },
  { value: '1', label: 'Cấp 1' },
  { value: '2', label: 'Cấp 2' },
  { value: '3', label: 'Cấp 3' },
  { value: '4', label: 'Cấp 4' },
  { value: '5', label: 'Cấp 5' },
];

interface DirectoryQuery {
  tab: Tab;
  status: string;
  trade: string;
  skill: string;
  q: string;
  sort: string;
  order: string;
  page: number;
}

function parseQuery(sp: URLSearchParams): DirectoryQuery {
  const raw = sp.get('tab');
  const tab: Tab = raw === 'contractors' ? 'contractors' : raw === 'crews' ? 'crews' : 'workers';
  const page = Math.max(1, Number.parseInt(sp.get('page') ?? '1', 10) || 1);
  return {
    tab,
    status: sp.get('status') ?? '',
    trade: sp.get('trade') ?? '',
    skill: sp.get('skill') ?? '',
    q: sp.get('q') ?? '',
    sort: sp.get('sort') || 'createdAt',
    order: sp.get('order') || 'desc',
    page,
  };
}

function toQueryString(q: DirectoryQuery): string {
  const qs = new URLSearchParams();
  qs.set('tab', q.tab);
  if (q.status) qs.set('status', q.status);
  if (q.tab === 'workers' && q.trade) qs.set('trade', q.trade);
  if (q.tab === 'workers' && q.skill) qs.set('skill', q.skill);
  if (q.q) qs.set('q', q.q);
  qs.set('sort', q.sort);
  qs.set('order', q.order);
  if (q.page > 1) qs.set('page', String(q.page));
  return qs.toString();
}

/**
 * Map fieldErrors từ API (keys server: status/tradeId/skillLevel/sort/order)
 * về field của form directory; key lạ → _global.
 */
function pickFieldError(fieldErrors: Record<string, string[]> | undefined, keys: string[]): string | null {
  if (!fieldErrors) return null;
  for (const k of keys) {
    const msgs = fieldErrors[k];
    if (msgs?.length) return msgs.join(' ');
  }
  return null;
}

function shortUuid(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

/**
 * ORG-SRS-005 (issue #28) — trang tra cứu nguồn lực read-only cho
 * ADMIN + PROJECT_MANAGER. Filter/sort/pagination đồng bộ URL query để giữ
 * khi quay lại; reads dùng cache no-store nên dữ liệu luôn hiện hành.
 * ORG-SRS-006 (issue #29) — bật tab Đội (listCrews, cùng pattern filter/sort/
 * pagination; rows read-only: code + tên + status + eligible + trưởng nhóm +
 * link chi tiết). KHÔNG thêm crew filter cho tab workers (defer #30).
 */
export function ResourceDirectory() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canView = useCanViewResourceDirectory();

  const queryKey = searchParams.toString();
  const query = React.useMemo(() => parseQuery(new URLSearchParams(queryKey)), [queryKey]);

  // Single source of truth cho URL đích: ref luôn giữ query MỚI NHẤT đã apply.
  // router.replace là async — window.location.search / query memo chưa kịp cập
  // nhật giữa 2 lần apply dồn dập, nên mỗi apply phải merge lên ref thay vì memo.
  const queryRef = React.useRef<DirectoryQuery>(query);
  React.useEffect(() => {
    queryRef.current = query;
  }, [query]);
  const lastPushedRef = React.useRef<string | null>(null);

  function apply(next: Partial<DirectoryQuery>) {
    const base = queryRef.current;
    const merged: DirectoryQuery = { ...base, ...next, page: next.page ?? (next.tab ? 1 : base.page) };
    // Đổi tab/filter → reset về trang 1 (trừ khi đang chuyển trang).
    if ((next.tab && next.tab !== base.tab) || next.status !== undefined || next.trade !== undefined || next.skill !== undefined || next.q !== undefined || next.sort !== undefined || next.order !== undefined) {
      if (next.page === undefined) merged.page = 1;
    }
    queryRef.current = merged;
    const target = `${pathname}?${toQueryString(merged)}`;
    // Guard chống reload loop / replace thừa: bỏ qua khi đích trùng URL hiện
    // tại hoặc trùng lần push ngay trước đó (replace async chưa kịp đổi URL).
    const current = typeof window !== 'undefined' ? `${pathname}${window.location.search}` : null;
    if (target === current || target === lastPushedRef.current) return;
    lastPushedRef.current = target;
    router.replace(target, { scroll: false });
  }

  const [qInput, setQInput] = React.useState(query.q);
  React.useEffect(() => {
    setQInput(query.q);
  }, [query.q]);

  const [trades, setTrades] = React.useState<Trade[]>([]);
  const tradeNames = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const t of trades) map.set(t.id, `${t.code} — ${t.name}`);
    return map;
  }, [trades]);
  const activeTrades = React.useMemo(() => trades.filter((t) => t.status === 'ACTIVE'), [trades]);

  const [workers, setWorkers] = React.useState<Worker[]>([]);
  const [contractors, setContractors] = React.useState<Contractor[]>([]);
  const [crews, setCrews] = React.useState<Crew[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);

  // Tải danh mục trade một lần cho select filter + map tên (PM đọc được
  // GET /trades sau API slice #28; lỗi thì select trống, row fallback UUID).
  React.useEffect(() => {
    let cancelled = false;
    async function loadTrades() {
      try {
        const res = await listTrades({ status: 'ALL', limit: 100 });
        if (!cancelled) setTrades(res.data);
      } catch {
        if (!cancelled) setTrades([]);
      }
    }
    void loadTrades();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const offset = (query.page - 1) * PAGE_SIZE;
        if (query.tab === 'workers') {
          const res = await listWorkers({
            search: query.q.trim() || undefined,
            status: query.status || undefined,
            tradeId: query.trade || undefined,
            skillLevel: query.skill ? Number(query.skill) : undefined,
            sort: query.sort,
            order: query.order,
            limit: PAGE_SIZE,
            offset,
          });
          if (!cancelled) {
            setWorkers(res.data);
            setTotal(res.total);
          }
        } else if (query.tab === 'contractors') {
          const res = await listContractors({
            search: query.q.trim() || undefined,
            status: query.status || undefined,
            sort: query.sort,
            order: query.order,
            limit: PAGE_SIZE,
            offset,
          });
          if (!cancelled) {
            setContractors(res.data);
            setTotal(res.total);
          }
        } else {
          const res = await listCrews({
            search: query.q.trim() || undefined,
            status: query.status || undefined,
            sort: query.sort,
            order: query.order,
            limit: PAGE_SIZE,
            offset,
          });
          if (!cancelled) {
            setCrews(res.data);
            setTotal(res.total);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e as ApiError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [canView, query, retryKey]);

  if (!canView) {
    return (
      <Card>
        <Alert tone="error">Không có quyền truy cập — cần vai trò ADMIN hoặc PROJECT_MANAGER (403)</Alert>
        <p style={{ color: 'var(--bf-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          Tài khoản hiện tại không đủ quyền để tra cứu nguồn lực.
        </p>
      </Card>
    );
  }

  const fieldErrors = error?.status === 400 ? (error.fieldErrors ?? {}) : {};
  const statusError = pickFieldError(fieldErrors, ['status']);
  const tradeError = pickFieldError(fieldErrors, ['tradeId', 'trade']);
  const skillError = pickFieldError(fieldErrors, ['skillLevel', 'skill']);
  const sortError = pickFieldError(fieldErrors, ['sort']);
  const orderError = pickFieldError(fieldErrors, ['order']);
  const globalFilterError = pickFieldError(fieldErrors, ['_global']) ?? (error?.status === 400 && !statusError && !tradeError && !skillError && !sortError && !orderError ? error.message : null);

  const statusOptions = query.tab === 'workers' ? WORKER_STATUSES : CONTRACTOR_STATUSES;  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasActiveFilter = Boolean(query.status || query.trade || query.skill || query.q);

  function handleClear() {
    setQInput('');
    apply({ status: '', trade: '', skill: '', q: '', sort: 'createdAt', order: 'desc', page: 1 });
  }

  function renderError() {
    if (!error || error.status === 400) return null;
    if (error.status === 401) {
      return (
        <Card>
          <Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại (401)</Alert>
          <div style={{ marginTop: '0.75rem' }}>
            <a href="/login" style={{ color: '#1d4ed8', textDecoration: 'underline' }}>
              Đến trang đăng nhập
            </a>
          </div>
        </Card>
      );
    }
    if (error.status === 403) {
      return (
        <Card>
          <Alert tone="error">Không có quyền truy cập — cần vai trò ADMIN hoặc PROJECT_MANAGER (403)</Alert>
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>
              Thử lại
            </Button>
          </div>
        </Card>
      );
    }
    if (error.status === 409) {
      // Reads là no-store nên hiếm; nếu API báo conflict (status đổi giữa chừng)
      // thì hiển thị info + retry để lấy dữ liệu hiện hành.
      return (
        <Card>
          <Alert tone="info">{error.message || 'Dữ liệu vừa thay đổi — vui lòng tải lại để xem trạng thái hiện hành.'}</Alert>
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>
              Tải lại
            </Button>
          </div>
        </Card>
      );
    }
    return (
      <Card>
        <Alert tone="error">{error.message || 'Không thể tải danh sách'}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>
            Thử lại
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div role="tablist" aria-label="Loại nguồn lực" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          role="tab"
          aria-selected={query.tab === 'workers'}
          onClick={() => apply({ tab: 'workers' })}
          className="bf-btn"
          style={query.tab === 'workers' ? { borderColor: 'var(--bf-accent)' } : undefined}
        >
          Công nhân
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={query.tab === 'contractors'}
          onClick={() => apply({ tab: 'contractors' })}
          className="bf-btn"
          style={query.tab === 'contractors' ? { borderColor: 'var(--bf-accent)' } : undefined}
        >
          Nhà thầu
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={query.tab === 'crews'}
          onClick={() => apply({ tab: 'crews' })}
          className="bf-btn"
          style={query.tab === 'crews' ? { borderColor: 'var(--bf-accent)' } : undefined}
        >
          Đội
        </button>
      </div>

      <Card>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <div className="bf-field" style={{ flex: '1 1 220px' }}>
            <label className="bf-label" htmlFor="directory-q">
              Tìm kiếm
            </label>
            <Input
              id="directory-q"
              placeholder={query.tab === 'workers' ? 'Tên, email, mã nhân viên…' : query.tab === 'crews' ? 'Mã, tên, mô tả đội…' : 'Mã, tên, liên hệ, email…'}
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') apply({ q: qInput.trim(), page: 1 });
              }}
            />
          </div>
          <div className="bf-field" style={{ minWidth: 160 }}>
            <label className="bf-label" htmlFor="directory-status">
              Trạng thái
            </label>
            <select
              id="directory-status"
              className="bf-input"
              value={query.status}
              onChange={(e) => apply({ status: e.target.value })}
              aria-invalid={statusError ? true : undefined}
              aria-describedby={statusError ? 'directory-status-error' : undefined}
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {statusError ? (
              <p id="directory-status-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                {statusError}
              </p>
            ) : null}
          </div>
          {query.tab === 'workers' ? (
            <>
              <div className="bf-field" style={{ minWidth: 180 }}>
                <label className="bf-label" htmlFor="directory-trade">
                  Ngành nghề
                </label>
                <select
                  id="directory-trade"
                  className="bf-input"
                  value={query.trade}
                  onChange={(e) => apply({ trade: e.target.value })}
                  aria-invalid={tradeError ? true : undefined}
                  aria-describedby={tradeError ? 'directory-trade-error' : undefined}
                >
                  <option value="">Tất cả ngành nghề</option>
                  {activeTrades.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code} — {t.name}
                    </option>
                  ))}
                </select>
                {tradeError ? (
                  <p id="directory-trade-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                    {tradeError}
                  </p>
                ) : null}
              </div>
              <div className="bf-field" style={{ minWidth: 140 }}>
                <label className="bf-label" htmlFor="directory-skill">
                  Cấp kỹ năng
                </label>
                <select
                  id="directory-skill"
                  className="bf-input"
                  value={query.skill}
                  onChange={(e) => apply({ skill: e.target.value })}
                  aria-invalid={skillError ? true : undefined}
                  aria-describedby={skillError ? 'directory-skill-error' : undefined}
                >
                  {SKILLS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {skillError ? (
                  <p id="directory-skill-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                    {skillError}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
          <div className="bf-field" style={{ minWidth: 140 }}>
            <label className="bf-label" htmlFor="directory-sort">
              Sắp xếp
            </label>
            <select
              id="directory-sort"
              className="bf-input"
              value={query.sort}
              onChange={(e) => apply({ sort: e.target.value })}
              aria-invalid={sortError ? true : undefined}
              aria-describedby={sortError ? 'directory-sort-error' : undefined}
            >
              {SORTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {sortError ? (
              <p id="directory-sort-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                {sortError}
              </p>
            ) : null}
          </div>
          <div className="bf-field" style={{ minWidth: 130 }}>
            <label className="bf-label" htmlFor="directory-order">
              Thứ tự
            </label>
            <select
              id="directory-order"
              className="bf-input"
              value={query.order}
              onChange={(e) => apply({ order: e.target.value })}
              aria-invalid={orderError ? true : undefined}
              aria-describedby={orderError ? 'directory-order-error' : undefined}
            >
              {ORDERS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {orderError ? (
              <p id="directory-order-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                {orderError}
              </p>
            ) : null}
          </div>
          <Button variant="secondary" onClick={() => apply({ q: qInput.trim(), page: 1 })}>
            Tìm
          </Button>
          {hasActiveFilter ? (
            <Button variant="secondary" onClick={handleClear}>
              Xóa bộ lọc
            </Button>
          ) : null}
        </div>
        {globalFilterError ? (
          <div style={{ marginTop: '0.75rem' }}>
            <Alert tone="error">{globalFilterError}</Alert>
          </div>
        ) : null}
        <p className="bf-card-meta" style={{ marginTop: '0.75rem' }}>
          Tổng: {total} hồ sơ · Hiển thị {query.tab === 'workers' ? workers.length : query.tab === 'crews' ? crews.length : contractors.length} · Dữ liệu
          hiện hành (không cache) · Trang {query.page}/{totalPages}
        </p>
      </Card>

      {loading ? (
        <Card>
          <p aria-busy="true">Đang tải danh sách…</p>
        </Card>
      ) : (
        renderError() ??
        (query.tab === 'workers'
          ? (workers.length === 0 ? (
            <Card>
              <EmptyState title="Chưa có công nhân nào phù hợp bộ lọc">
                Thử đổi từ khóa, trạng thái, ngành nghề hoặc cấp kỹ năng — hoặc{' '}
                <button type="button" onClick={handleClear} style={{ color: '#1d4ed8', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}>
                  xóa bộ lọc
                </button>
                .
              </EmptyState>
            </Card>
          ) : (
            <>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {workers.map((w) => (
                  <Card key={w.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>
                          <a href={`/workers/${w.id}`} style={{ color: '#111827', textDecoration: 'underline' }}>
                            {w.fullName}
                          </a>{' '}
                          <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.9rem' }}>
                            · {w.employeeCode ?? shortUuid(w.id)}
                          </span>
                        </div>
                        <div style={{ marginTop: 4, fontSize: '0.88rem', color: '#374151' }}>
                          <StatusBadge status={w.status} /> ·{' '}
                          <span style={{ color: w.eligible ? '#065f46' : '#991b1b' }}>
                            {w.eligible ? 'Đủ điều kiện phân công' : 'Không đủ điều kiện (inactive/locked)'}
                          </span>
                        </div>
                        <div style={{ marginTop: 4, fontSize: '0.85rem', color: '#6b7280' }}>
                          Ngành nghề:{' '}
                          {w.trades.length
                            ? w.trades
                              .map((t) => {
                                const label = tradeNames.get(t.tradeId);
                                return label ? `${label} · Lv${t.skillLevel}` : `${shortUuid(t.tradeId)} · Lv${t.skillLevel}`;
                              })
                              .join(', ')
                            : '—'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <a href={`/workers/${w.id}`} style={{ fontSize: '0.9rem', color: '#1d4ed8', textDecoration: 'underline' }}>
                          Chi tiết
                        </a>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              <Pagination page={query.page} totalPages={totalPages} onPage={(page) => apply({ page })} />
            </>
          ))
          : query.tab === 'crews'
            ? (crews.length === 0 ? (
              <Card>
                <EmptyState title="Chưa có đội thi công nào phù hợp bộ lọc">
                  Thử đổi từ khóa hoặc trạng thái — hoặc{' '}
                  <button type="button" onClick={handleClear} style={{ color: '#1d4ed8', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}>
                    xóa bộ lọc
                  </button>
                  .
                </EmptyState>
              </Card>
            ) : (
              <>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {crews.map((c) => (
                    <Card key={c.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>
                            <a href={`/crews/${c.id}`} style={{ color: '#111827', textDecoration: 'underline' }}>
                              {c.name}
                            </a>{' '}
                            <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.9rem' }}>· {c.code}</span>
                          </div>
                          <div style={{ marginTop: 4, fontSize: '0.88rem', color: '#374151' }}>
                            <StatusBadge status={c.status} /> ·{' '}
                            <span style={{ color: c.eligible ? '#065f46' : '#991b1b' }}>
                              {c.eligible ? 'Đủ điều kiện phân công' : 'Không nhận việc mới'}
                            </span>
                          </div>
                          <div style={{ marginTop: 4, fontSize: '0.85rem', color: '#6b7280' }}>
                            Trưởng nhóm: {c.leaderUserId ? shortUuid(c.leaderUserId) : '— chưa chỉ định —'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <a href={`/crews/${c.id}`} style={{ fontSize: '0.9rem', color: '#1d4ed8', textDecoration: 'underline' }}>
                            Chi tiết
                          </a>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                <Pagination page={query.page} totalPages={totalPages} onPage={(page) => apply({ page })} />
              </>
            ))
            : (contractors.length === 0 ? (
            <Card>
              <EmptyState title="Chưa có nhà thầu nào phù hợp bộ lọc">
                Thử đổi từ khóa hoặc trạng thái — hoặc{' '}
                <button type="button" onClick={handleClear} style={{ color: '#1d4ed8', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}>
                  xóa bộ lọc
                </button>
                .
              </EmptyState>
            </Card>
          ) : (
            <>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {contractors.map((c) => (
                  <Card key={c.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>
                          <a href={`/contractors/${c.id}`} style={{ color: '#111827', textDecoration: 'underline' }}>
                            {c.name}
                          </a>{' '}
                          <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.9rem' }}>· {c.code}</span>
                        </div>
                        <div style={{ marginTop: 4, fontSize: '0.88rem', color: '#374151' }}>
                          Liên hệ: {c.contactName ?? '—'} · SĐT: {c.phone ?? '—'} ·{' '}
                          <StatusBadge status={c.status} /> ·{' '}
                          <span style={{ color: c.eligible ? '#065f46' : '#991b1b' }}>
                            {c.eligible ? 'Đủ điều kiện phân công' : 'Không đủ điều kiện'}
                          </span>
                        </div>
                        <div style={{ marginTop: 4, fontSize: '0.85rem', color: '#6b7280' }}>
                          Phạm vi: {c.scope ? (c.scope.length > 120 ? `${c.scope.slice(0, 120)}…` : c.scope) : '—'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <a href={`/contractors/${c.id}`} style={{ fontSize: '0.9rem', color: '#1d4ed8', textDecoration: 'underline' }}>
                          Chi tiết
                        </a>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              <Pagination page={query.page} totalPages={totalPages} onPage={(page) => apply({ page })} />
            </>
          )))
      )}
    </div>
  );
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Phân trang" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
      <Button variant="secondary" onClick={() => onPage(page - 1)} disabled={page <= 1}>
        Trang trước
      </Button>
      <span style={{ fontSize: '0.9rem', color: 'var(--bf-muted)' }} aria-live="polite">
        Trang {page}/{totalPages}
      </span>
      <Button variant="secondary" onClick={() => onPage(page + 1)} disabled={page >= totalPages}>
        Trang sau
      </Button>
    </nav>
  );
}
