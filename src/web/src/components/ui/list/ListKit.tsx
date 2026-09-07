'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button/Button';
import { Input } from '@/components/ui/input/Input';
import { cn } from '@/lib/cn';

/**
 * List-screen kit — toolbar / search / count / chips / pagination dùng chung
 * cho 8 list pages (DashCode). Chỉ lo layout + a11y; logic filter/pagination
 * vẫn nằm ở từng feature (không đổi API calls/business logic).
 *
 * Text contract giữ nguyên cho E2E drivers: nút 'Tìm' / 'Xóa bộ lọc',
 * 'Trang trước' / 'Trang sau' / 'Trước' / 'Sau', `aria-label="Phân trang"`.
 */

export function SearchIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/**
 * Ô Search trong toolbar: icon SVG bên trái, label sr-only (giữ association
 * cho getByLabelText + combobox a11y), width ~260px qua `.bf-search`.
 */
export function SearchField({
  id,
  label,
  placeholder,
  value,
  onChange,
  onSubmit,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
}) {
  return (
    <div className="bf-search">
      <label className="bf-sr-only" htmlFor={id}>
        {label}
      </label>
      <SearchIcon />
      <Input
        id={id}
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit?.();
        }}
      />
    </div>
  );
}

/**
 * Toolbar 1 hàng responsive: controls trái (`children`), count text phải.
 */
export function ListToolbar({
  children,
  count,
}: {
  children: React.ReactNode;
  count?: React.ReactNode;
}) {
  return (
    <div className="bf-list-toolbar">
      <div className="bf-list-toolbar-main">{children}</div>
      {count ? (
        <p className="bf-list-count" aria-live="polite">
          {count}
        </p>
      ) : null}
    </div>
  );
}

/** Nút 'Xóa bộ lọc' (ghost) — caller chỉ render khi có filter active. */
export function ClearFiltersButton({ onClear }: { onClear: () => void }) {
  return (
    <Button variant="ghost" onClick={onClear}>
      Xóa bộ lọc
    </Button>
  );
}

export interface ActiveChip {
  key: string;
  label: string;
  onRemove: () => void;
}

/** Chips filter đang active (dùng khi >3 controls). */
export function ActiveChips({ chips }: { chips: readonly ActiveChip[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="bf-chips" aria-label="Bộ lọc đang áp dụng">
      {chips.map((chip) => (
        <span key={chip.key} className="bf-chip">
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={`Xóa bộ lọc ${chip.label}`}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

/**
 * Phân trang thống nhất: Prev/Next icon buttons + 'Trang X/Y' giữa.
 * `prevLabel`/`nextLabel` giữ text contract từng trang
 * ('Trước'/'Sau' hoặc 'Trang trước'/'Trang sau').
 */
export function ListPagination({
  page,
  totalPages,
  onPage,
  prevLabel = 'Trước',
  nextLabel = 'Sau',
  className,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  prevLabel?: string;
  nextLabel?: string;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Phân trang" className={cn('bf-pagination', className)}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
      >
        <ChevronLeftIcon />
        {prevLabel}
      </Button>
      <span className="bf-page-indicator" aria-live="polite">
        Trang {page}/{totalPages}
      </span>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
      >
        {nextLabel}
        <ChevronRightIcon />
      </Button>
    </nav>
  );
}
