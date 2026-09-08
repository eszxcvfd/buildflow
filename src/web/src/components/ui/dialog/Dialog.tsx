'use client';

import { Dialog as ArkDialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import * as React from 'react';
import { cn } from '@/lib/cn';

export type DialogSize = 'sm' | 'md' | 'lg';

const DIALOG_SIZE_WIDTH: Record<DialogSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
};

export interface DialogProps {
  /** Dialog title (rendered in the header). */
  title: React.ReactNode;
  children: React.ReactNode;
  /** Controlled open state; defaults to open when the dialog is mounted. */
  open?: boolean;
  /** Called when the dialog requests close (Escape, backdrop, close button). */
  onClose?: () => void;
  className?: string;
  /**
   * Chuẩn kích thước panel (wrapper-level, khỏi sửa từng dialog):
   * sm/max-w-md, md/max-w-xl, lg/max-w-3xl. Không truyền `size` thì
   * giữ `max-w-lg` hiện tại. `className` có `max-w-*` riêng vẫn thắng
   * (đặt sau trong `cn`), vd `max-w-2xl` ở WorkerCreateDialog.
   */
  size?: DialogSize;
}

/**
 * DashCode stage 2 — Ark UI Dialog wrapper. Overlay dims with
 * `bg-slate-900/60 backdrop-blur-sm`; panel is a white `rounded-md`
 * card with `shadow-base2`. Content always mounts while open so
 * server-rendered text/roles stay queryable in tests.
 *
 * Layout chuẩn (fix popup CRUD dài bị che — wrapper-level):
 * panel `flex flex-col` + `max-h: min(85vh, 900px)`; header
 * `flex-shrink-0` luôn nhìn thấy; body `.bf-dialog__body`
 * (`flex-1 min-h-0 overflow-y-auto`) scroll bên trong; footer actions
 * của form (`.bf-form-actions`) sticky đáy body (xem globals.css).
 * Trên màn thấp (768px) header + nút Lưu luôn thấy; mobile (<640px)
 * panel full-width trừ margin nhỏ của positioner.
 */
export function Dialog({ title, children, open, onClose, className, size }: DialogProps) {
  return (
    <ArkDialog.Root
      open={open}
      defaultOpen={open === undefined ? true : undefined}
      onOpenChange={(details) => {
        if (!details.open) onClose?.();
      }}
    >
      {/* v5.39 Dialog không còn export Portal riêng — dùng Portal standalone
          (cùng Ark primitive, render overlay ra document.body). */}
      <Portal>
        <ArkDialog.Backdrop className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm" />
        <ArkDialog.Positioner className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
        <ArkDialog.Content
          className={cn(
            'bf-dialog',
            'flex w-full flex-col rounded-md bg-white shadow-base2',
            size ? DIALOG_SIZE_WIDTH[size] : 'max-w-lg',
            className,
          )}
          // Ark Content loại class chứa dấu phẩy (vd max-h-[min(85vh,900px)])
          // nên max-height chuẩn đặt inline + fallback `.bf-dialog` trong CSS.
          style={{ maxHeight: 'min(85vh, 900px)' }}
        >
          <div className="bf-dialog__header flex flex-shrink-0 items-start justify-between gap-4 border-b border-slate-200/60 px-5 py-4">
            <ArkDialog.Title className="text-base font-semibold text-slate-800">
              {title}
            </ArkDialog.Title>
            <ArkDialog.CloseTrigger
              aria-label="Đóng"
              className="rounded-[4px] px-2 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-primary-500"
            >
              ×
            </ArkDialog.CloseTrigger>
          </div>
          <div className="bf-dialog__body min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </ArkDialog.Content>
      </ArkDialog.Positioner>
      </Portal>
    </ArkDialog.Root>
  );
}
