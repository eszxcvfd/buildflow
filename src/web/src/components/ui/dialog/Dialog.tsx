'use client';

import { Dialog as ArkDialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import * as React from 'react';
import { cn } from '@/lib/cn';

export interface DialogProps {
  /** Dialog title (rendered in the header). */
  title: React.ReactNode;
  children: React.ReactNode;
  /** Controlled open state; defaults to open when the dialog is mounted. */
  open?: boolean;
  /** Called when the dialog requests close (Escape, backdrop, close button). */
  onClose?: () => void;
  className?: string;
}

/**
 * DashCode stage 2 — Ark UI Dialog wrapper. Overlay dims with
 * `bg-slate-900/60 backdrop-blur-sm`; panel is a white `rounded-md`
 * card with `shadow-base2`. Content always mounts while open so
 * server-rendered text/roles stay queryable in tests.
 */
export function Dialog({ title, children, open, onClose, className }: DialogProps) {
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
        <ArkDialog.Positioner className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
        <ArkDialog.Content
          className={cn('bf-dialog', 'w-full max-w-lg rounded-md bg-white shadow-base2', className)}
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-200/60 px-5 py-4">
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
          <div className="px-5 py-4">{children}</div>
        </ArkDialog.Content>
      </ArkDialog.Positioner>
      </Portal>
    </ArkDialog.Root>
  );
}
