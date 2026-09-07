'use client';

import { Toast as ArkToast, Toaster as ArkToaster, createToaster } from '@ark-ui/react/toast';
import * as React from 'react';

/** Shared toaster instance — feature code calls `toast.create(...)`. */
export const toast = createToaster({
  placement: 'top-end',
  overlap: true,
  max: 4,
});

/** DashCode-styled Toaster; mount once in the root layout. Feature code fires
 *  transient success/info notices via `toast.success(...)` / `toast.info(...)`
 *  alongside the persistent inline `Alert` (which keeps spec/E2E asserts). */
export function Toaster() {
  return (
    <ArkToaster toaster={toast}>
      {(t) => (
        <ArkToast.Root
          key={t.id}
          className="flex w-80 items-start gap-3 rounded-md border border-gray-200 bg-white px-4 py-3 shadow-base2"
        >
          <div className="min-w-0 flex-1">
            {t.title ? (
              <ArkToast.Title className="text-sm font-semibold text-slate-800">{t.title}</ArkToast.Title>
            ) : null}
            {t.description ? (
              <ArkToast.Description className="mt-0.5 text-sm text-slate-600">
                {t.description}
              </ArkToast.Description>
            ) : null}
          </div>
          <ArkToast.CloseTrigger
            aria-label="Đóng thông báo"
            className="rounded-[4px] px-1.5 py-0.5 text-slate-500 hover:bg-slate-100"
          >
            ×
          </ArkToast.CloseTrigger>
        </ArkToast.Root>
      )}
    </ArkToaster>
  );
}
