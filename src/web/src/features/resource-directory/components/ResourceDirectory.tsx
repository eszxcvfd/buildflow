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
import { Select } from '@/components/ui/select/Select';
import { StatusBadge } from '@/components/ui/badge/StatusBadge';
import { Tabs } from '@/components/ui/tabs/Tabs';
import { Tooltip } from '@/components/ui/tooltip/Tooltip';
import {
  ActiveChips,
  ClearFiltersButton,
  ListPagination,
  ListToolbar,
  SearchField,
} from '@/components/ui/list/ListKit';

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
  /** ORG-SRS-007 (issue #30, D9) — lọc workers theo đội (?crew=<crewId>), chỉ tab workers. */
  crew: string;
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
    crew: sp.get('crew') ?? '',
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
  if (q.tab === 'workers' && q.crew) qs.set('crew', q.crew);
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
 * link chi tiết). ORG-SRS-007 (issue #30, D9) — tab workers có thêm lọc theo đội
 * (?crew=<crewId> → listWorkers({ crewId }), options từ crews ACTIVE).
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
    if ((next.tab && next.tab !== base.tab) || next.status !== undefined || next.trade !== undefined || next.skill !== undefined || next.crew !== undefined || next.q !== undefined || next.sort !== undefined || next.order !== undefined) {
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
  const [activeCrews, setActiveCrews] = React.useState<Crew[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);

  // Tải danh mục trade một lần cho select filter + map tên (PM đọc được
  // GET /trades sau API slice #28; lỗi thì select trống, row fallback UUID).
  // ORG-SRS-007 (issue #30, D9) — tải crews ACTIVE một lần cho select lọc
  // theo đội ở tab workers (label `name · code`).
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
    async function loadActiveCrews() {
      try {
        const res = await listCrews({ status: 'ACTIVE', limit: 100 });
        if (!cancelled) setActiveCrews(res.data);
      } catch {
        if (!cancelled) setActiveCrews([]);
      }
    }
    void loadTrades();
    void loadActiveCrews();
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
            crewId: query.crew || undefined,
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

  const statusOptions = query.tab === 'workers' ? WORKER_STATUSES : CONTRACTOR_STATUSES;  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasActiveFilter = Boolean(query.status || query.trade || query.skill || query.crew || query.q);

  function handleClear() {
    setQInput('');
    apply({ status: '', trade: '', skill: '', crew: '', q: '', sort: 'createdAt', order: 'desc', page: 1 });
  }

  const directoryChips = React.useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
    if (query.status) {
      const opt = statusOptions.find((o) => o.value === query.status);
      chips.push({ key: 'status', label: `Trạng thái: ${opt?.label ?? query.status}`, onRemove: () => apply({ status: '' }) });
    }
    if (query.tab === 'workers' && query.trade) {
      const t = trades.find((x) => x.id === query.trade);
      chips.push({ key: 'trade', label: `Ngành: ${t ? `${t.code} — ${t.name}` : 'đã chọn'}`, onRemove: () => apply({ trade: '' }) });
    }
    if (query.tab === 'workers' && query.skill) {
      chips.push({ key: 'skill', label: `Cấp ${query.skill}`, onRemove: () => apply({ skill: '' }) });
    }
    if (query.tab === 'workers' && query.crew) {
      const c = activeCrews.find((x) => x.id === query.crew);
      chips.push({ key: 'crew', label: `Đội: ${c ? c.name : 'đã chọn'}`, onRemove: () => apply({ crew: '' }) });
    }
    if (query.q) {
      chips.push({ key: 'q', label: `Tìm: “${query.q}”`, onRemove: () => { setQInput(''); apply({ q: '' }); } });
    }
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, trades, activeCrews, statusOptions]);

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
  const crewError = pickFieldError(fieldErrors, ['crewId', 'crew']);
  const sortError = pickFieldError(fieldErrors, ['sort']);
  const orderError = pickFieldError(fieldErrors, ['order']);
  const globalFilterError = pickFieldError(fieldErrors, ['_global']) ?? (error?.status === 400 && !statusError && !tradeError && !skillError && !crewError && !sortError && !orderError ? error.message : null);

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
      <Tabs
        value={query.tab}
        aria-label="Loại nguồn lực"
        onChange={(v) => apply({ tab: v as Tab })}
        items={[
          { value: 'workers', label: 'Công nhân' },
          { value: 'contractors', label: 'Nhà thầu' },
          { value: 'crews', label: 'Đội' },
        ]}
      />

      <Card>
        <ListToolbar
          count={`Tổng: ${total} hồ sơ · Hiển thị ${query.tab === 'workers' ? workers.length : query.tab === 'crews' ? crews.length : contractors.length} · Trang ${query.page}/${totalPages}`}
        >
          <SearchField
            id="directory-q"
            label="Tìm kiếm"
            placeholder={query.tab === 'workers' ? 'Tên, email, mã nhân viên…' : query.tab === 'crews' ? 'Mã, tên, mô tả đội…' : 'Mã, tên, liên hệ, email…'}
            value={qInput}
            onChange={setQInput}
            onSubmit={() => apply({ q: qInput.trim(), page: 1 })}
          />
          <div className="bf-filter">
            <Select
              id="directory-status"
              label="Trạng thái"
              hideLabel
              value={query.status}
              options={statusOptions}
              onChange={(v) => apply({ status: v })}
              aria-invalid={statusError ? true : undefined}
              aria-describedby={statusError ? 'directory-status-error' : undefined}
            />
            {statusError ? (
              <p id="directory-status-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                {statusError}
              </p>
            ) : null}
          </div>
          {query.tab === 'workers' ? (
            <>
              <div className="bf-filter bf-filter-wide">
                <Select
                  id="directory-trade"
                  label="Ngành nghề"
                  hideLabel
                  value={query.trade}
                  options={[
                    { value: '', label: 'Tất cả ngành nghề' },
                    ...activeTrades.map((t) => ({ value: t.id, label: `${t.code} — ${t.name}` })),
                  ]}
                  onChange={(v) => apply({ trade: v })}
                  aria-invalid={tradeError ? true : undefined}
                  aria-describedby={tradeError ? 'directory-trade-error' : undefined}
                />
                {tradeError ? (
                  <p id="directory-trade-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                    {tradeError}
                  </p>
                ) : null}
              </div>
              <div className="bf-filter">
                <Select
                  id="directory-skill"
                  label="Cấp kỹ năng"
                  hideLabel
                  value={query.skill}
                  options={SKILLS}
                  onChange={(v) => apply({ skill: v })}
                  aria-invalid={skillError ? true : undefined}
                  aria-describedby={skillError ? 'directory-skill-error' : undefined}
                />
                {skillError ? (
                  <p id="directory-skill-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                    {skillError}
                  </p>
                ) : null}
              </div>
              <div className="bf-filter bf-filter-wide">
                <Select
                  id="directory-crew"
                  label="Đội thi công"
                  hideLabel
                  value={query.crew}
                  options={[
                    { value: '', label: 'Tất cả các đội' },
                    ...activeCrews.map((c) => ({ value: c.id, label: `${c.name} · ${c.code}` })),
                  ]}
                  onChange={(v) => apply({ crew: v })}
                  aria-invalid={crewError ? true : undefined}
                  aria-describedby={crewError ? 'directory-crew-error' : undefined}
                />
                {crewError ? (
                  <p id="directory-crew-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                    {crewError}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
          <div className="bf-filter">
            <Select
              id="directory-sort"
              label="Sắp xếp"
              hideLabel
              value={query.sort}
              options={SORTS}
              onChange={(v) => apply({ sort: v })}
              aria-invalid={sortError ? true : undefined}
              aria-describedby={sortError ? 'directory-sort-error' : undefined}
            />
            {sortError ? (
              <p id="directory-sort-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                {sortError}
              </p>
            ) : null}
          </div>
          <div className="bf-filter">
            <Select
              id="directory-order"
              label="Thứ tự"
              hideLabel
              value={query.order}
              options={ORDERS}
              onChange={(v) => apply({ order: v })}
              aria-invalid={orderError ? true : undefined}
              aria-describedby={orderError ? 'directory-order-error' : undefined}
            />
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
            <ClearFiltersButton onClear={handleClear} />
          ) : null}
        </ListToolbar>
        <ActiveChips chips={directoryChips} />
        {globalFilterError ? (
          <div style={{ marginTop: '0.75rem' }}>
            <Alert tone="error">{globalFilterError}</Alert>
          </div>
        ) : null}
        <p className="bf-card-meta" style={{ marginTop: '0.75rem' }}>
          Dữ liệu hiện hành (không cache).
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
            <Card>
              <div className="bf-table-wrap">
                <table className="bf-table">
                  <thead>
                    <tr>
                      <th>Tên</th>
                      <th>Mã NV</th>
                      <th>Trạng thái</th>
                      <th>Điều kiện phân công</th>
                      <th>Ngành nghề</th>
                      <th style={{ textAlign: 'right' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workers.map((w) => (
                      <tr key={w.id}>
                        <td>
                          <a href={`/workers/${w.id}`} style={{ color: '#111827', fontWeight: 600, textDecoration: 'none' }}>
                            {w.fullName}
                          </a>
                        </td>
                        <td>{w.employeeCode ?? shortUuid(w.id)}</td>
                        <td><StatusBadge status={w.status} /></td>
                        <td>
                          <span style={{ color: w.eligible ? '#065f46' : '#991b1b' }}>
                            {w.eligible ? 'Đủ điều kiện phân công' : 'Không đủ điều kiện (inactive/locked)'}
                          </span>
                        </td>
                        <td style={{ color: '#6b7280', maxWidth: 260 }}>
                          {w.trades.length
                            ? w.trades
                              .map((t) => {
                                const label = tradeNames.get(t.tradeId);
                                return label ? `${label} · Lv${t.skillLevel}` : `${shortUuid(t.tradeId)} · Lv${t.skillLevel}`;
                              })
                              .join(', ')
                            : '—'}
                        </td>
                        <td className="bf-cell-actions">
                          <span className="bf-row-actions">
                            <Tooltip content="Xem hồ sơ chi tiết">
                              <a className="bf-detail-link" href={`/workers/${w.id}`}>
                                Chi tiết
                              </a>
                            </Tooltip>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ListPagination page={query.page} totalPages={totalPages} onPage={(page) => apply({ page })} prevLabel="Trang trước" nextLabel="Trang sau" />
            </Card>
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
              <Card>
                <div className="bf-table-wrap">
                  <table className="bf-table">
                    <thead>
                      <tr>
                        <th>Tên</th>
                        <th>Mã</th>
                        <th>Trạng thái</th>
                        <th>Điều kiện phân công</th>
                        <th>Trưởng nhóm</th>
                        <th style={{ textAlign: 'right' }}>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crews.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <a href={`/crews/${c.id}`} style={{ color: '#111827', fontWeight: 600, textDecoration: 'none' }}>
                              {c.name}
                            </a>
                          </td>
                          <td>{c.code}</td>
                          <td><StatusBadge status={c.status} /></td>
                          <td>
                            <span style={{ color: c.eligible ? '#065f46' : '#991b1b' }}>
                              {c.eligible ? 'Đủ điều kiện phân công' : 'Không nhận việc mới'}
                            </span>
                          </td>
                          <td style={{ color: '#6b7280' }}>
                            {c.leaderUserId ? shortUuid(c.leaderUserId) : '— chưa chỉ định —'}
                          </td>
                          <td className="bf-cell-actions">
                            <span className="bf-row-actions">
                              <Tooltip content="Xem chi tiết đội">
                                <a className="bf-detail-link" href={`/crews/${c.id}`}>
                                  Chi tiết
                                </a>
                              </Tooltip>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ListPagination page={query.page} totalPages={totalPages} onPage={(page) => apply({ page })} prevLabel="Trang trước" nextLabel="Trang sau" />
              </Card>
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
            <Card>
              <div className="bf-table-wrap">
                <table className="bf-table">
                  <thead>
                    <tr>
                      <th>Tên</th>
                      <th>Mã</th>
                      <th>Liên hệ</th>
                      <th>Trạng thái</th>
                      <th>Điều kiện phân công</th>
                      <th>Phạm vi</th>
                      <th style={{ textAlign: 'right' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contractors.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <a href={`/contractors/${c.id}`} style={{ color: '#111827', fontWeight: 600, textDecoration: 'none' }}>
                            {c.name}
                          </a>
                        </td>
                        <td>{c.code}</td>
                        <td style={{ color: '#374151' }}>
                          {c.contactName ?? '—'}
                          <div className="bf-card-meta">{c.phone ?? ''}</div>
                        </td>
                        <td><StatusBadge status={c.status} /></td>
                        <td>
                          <span style={{ color: c.eligible ? '#065f46' : '#991b1b' }}>
                            {c.eligible ? 'Đủ điều kiện phân công' : 'Không đủ điều kiện'}
                          </span>
                        </td>
                        <td style={{ color: '#6b7280', maxWidth: 240 }}>
                          {c.scope ? (c.scope.length > 120 ? `${c.scope.slice(0, 120)}…` : c.scope) : '—'}
                        </td>
                        <td className="bf-cell-actions">
                          <span className="bf-row-actions">
                            <Tooltip content="Xem hồ sơ chi tiết">
                              <a className="bf-detail-link" href={`/contractors/${c.id}`}>
                                Chi tiết
                              </a>
                            </Tooltip>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ListPagination page={query.page} totalPages={totalPages} onPage={(page) => apply({ page })} prevLabel="Trang trước" nextLabel="Trang sau" />
            </Card>
          )))
      )}
    </div>
  );
}
