'use client';

import * as React from 'react';
import { listProjectAreas, type Project, type ProjectsError } from '@/lib/api/projects';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { ChevronRightIcon } from '@/components/ui/icons/Icons';
import { ListPagination } from '@/components/ui/list/ListKit';
import { formatUpdatedAt, statusVisual } from '../lib/statusVisual';

const PAGE_SIZE = 20;

/**
 * Web redesign — bảng dày 9 cột data-dense theo mẫu (render layer mới).
 * Nhận data + filter đã hoist từ ProjectsView qua props; chỉ giữ pagination
 * local. Mọi ô truy vết về field API thật hoặc placeholder '—' (xem §4 plan).
 * Giữ contract E2E rẻ tiền: class `.bf-table`, link `a[href^="/projects/"]`,
 * footer "Tổng {n} dự án", pagination "Trang X/Y", các state loading/401/
 * 403/empty/retry và copy cũ.
 */
export function ProjectsList({
  rows,
  loading,
  error,
  onRetry,
  hasFilter,
  selectedId,
  onSelect,
}: {
  rows: Project[];
  loading: boolean;
  error: ProjectsError | null;
  onRetry: () => void;
  hasFilter: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [page, setPage] = React.useState(0);
  const [areas, setAreas] = React.useState<Record<string, { active: number; total: number } | null>>({});

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  // Hạng mục x/y (bounded): fetch song song ≤20 row hiển thị, fail → '—'.
  React.useEffect(() => {
    let cancelled = false;
    const ids = pageRows.map((p) => p.id);
    setAreas((prev) => {
      const next: typeof prev = {};
      for (const id of ids) if (id in prev) next[id] = prev[id];
      return next;
    });
    async function fetchAreas() {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await listProjectAreas(id);
            return { id, value: { active: res.data.filter((a) => a.isActive).length, total: res.total } } as const;
          } catch {
            return { id, value: null } as const;
          }
        }),
      );
      if (cancelled) return;
      setAreas((prev) => {
        const next = { ...prev };
        for (const r of results) next[r.id] = r.value;
        return next;
      });
    }
    if (ids.length > 0) void fetchAreas();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, safePage]);

  // Reset về trang 1 khi tập rows đổi (filter/search thay đổi).
  React.useEffect(() => {
    setPage(0);
  }, [rows]);

  if (loading) {
    return <Card><p aria-busy="true">Đang tải…</p></Card>;
  }

  if (error) {
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
          <Alert tone="info">Bạn không có quyền xem dự án</Alert>
          {error.message ? (
            <p style={{ margin: '0.75rem 0 0', color: 'var(--bf-muted)' }}>{error.message}</p>
          ) : null}
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={onRetry}>Thử lại</Button>
          </div>
        </Card>
      );
    }
    return (
      <Card>
        <Alert tone="error">{error.message}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={onRetry}>Thử lại</Button>
        </div>
      </Card>
    );
  }

  if (pageRows.length === 0) {
    return (
      <Card>
        <EmptyState
          title={hasFilter ? 'Không có dự án nào phù hợp bộ lọc' : 'Bạn chưa là thành viên dự án nào'}
        >
          {hasFilter ? 'Thử đổi từ khóa hoặc trạng thái.' : 'Liên hệ quản trị viên để được thêm vào dự án.'}
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="bf-table w-full border-collapse text-left text-xs">
          <thead>
            <tr className="select-none border-b border-zinc-200 bg-zinc-50 text-[11px] font-medium text-zinc-500">
              <th className="w-8 text-center">
                <span className="sr-only">Chọn</span>
              </th>
              <th className="bf-mono w-16">MÃ</th>
              <th>TÊN DỰ ÁN</th>
              <th className="w-28">TRẠNG THÁI</th>
              <th className="w-36">TIẾN ĐỘ</th>
              <th className="bf-mono w-28 text-right">NGÂN SÁCH</th>
              <th className="w-32">CHỈ HUY TRƯỞNG</th>
              <th className="bf-mono w-20 text-center">HẠNG MỤC</th>
              <th className="w-10 text-right">
                <span className="sr-only">Chi tiết</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200/70 tabular-nums">
            {pageRows.map((p) => {
              const selected = selectedId === p.id;
              const v = statusVisual(p.status);
              const area = areas[p.id];
              return (
                <tr
                  key={p.id}
                  aria-selected={selected}
                  onClick={() => onSelect(selected ? null : p.id)}
                  className={
                    selected
                      ? 'cursor-pointer bg-blue-50/50 transition-colors hover:bg-blue-50/70'
                      : 'cursor-pointer transition-colors hover:bg-zinc-50'
                  }
                >
                  <td className="text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onSelect(selected ? null : p.id)}
                      aria-label={`Chọn dự án ${p.code}`}
                      className="rounded border-zinc-300 text-blue-600 focus:ring-0"
                    />
                  </td>
                  <td>
                    <span
                      className={
                        selected
                          ? 'bf-mono rounded border border-blue-200 bg-blue-100/70 px-1 py-0.5 text-[10px] font-bold text-blue-700'
                          : 'bf-mono rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-semibold text-zinc-600'
                      }
                    >
                      {p.code}
                    </span>
                  </td>
                  <td>
                    <span className="block font-semibold leading-tight text-zinc-900">{p.name}</span>
                    <span className="text-[10px] text-zinc-400">Cập nhật {formatUpdatedAt(p.updatedAt)}</span>
                  </td>
                  <td>
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${v.textClass}`}>
                      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${v.dotClass}`} />
                      {v.label}
                    </span>
                  </td>
                  <td>
                    <div aria-hidden="true" className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full rounded-full bg-zinc-200" style={{ width: '0%' }} />
                    </div>
                    <span className="bf-mono whitespace-nowrap text-[10px] text-zinc-400">— Chưa có dữ liệu tiến độ</span>
                  </td>
                  <td className="bf-mono text-right font-medium text-zinc-400">—</td>
                  <td className="text-[11px] text-zinc-400">—</td>
                  <td className="bf-mono text-center text-[11px] text-zinc-600">
                    {area && area.total > 0 ? (
                      <span title="hạng mục đang hoạt động/tổng">{area.active}/{area.total}</span>
                    ) : (
                      <span title={area ? 'Dự án chưa có hạng mục' : 'Chưa có dữ liệu hạng mục'}>—</span>
                    )}
                  </td>
                  <td className="text-right">
                    <a
                      href={`/projects/${p.id}`}
                      aria-label={`Mở chi tiết dự án ${p.code}`}
                      onClick={(e) => e.stopPropagation()}
                      className={selected ? 'inline text-blue-600' : 'inline text-zinc-300 hover:text-zinc-500'}
                    >
                      <ChevronRightIcon size={16} />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs text-zinc-500">
        <span className="bf-mono text-[11px]">Tổng {total} dự án</span>
        <ListPagination
          page={safePage + 1}
          totalPages={totalPages}
          onPage={(next) => setPage(next - 1)}
          prevLabel="Trước"
          nextLabel="Sau"
        />
      </div>
    </div>
  );
}
