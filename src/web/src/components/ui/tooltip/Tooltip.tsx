'use client';

import { Tooltip as ArkTooltip } from '@ark-ui/react/tooltip';
import * as React from 'react';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
}

/** Thin Ark UI Tooltip wrapper for future use (DashCode dark bubble). */
export function Tooltip({ content, children, disabled }: TooltipProps) {
  if (disabled) return <>{children}</>;
  return (
    <ArkTooltip.Root openDelay={200} closeDelay={100}>
      <ArkTooltip.Trigger asChild>{children}</ArkTooltip.Trigger>
      <ArkTooltip.Positioner>
        <ArkTooltip.Content className="z-50 max-w-xs rounded-[4px] bg-slate-800 px-2.5 py-1.5 text-xs text-white shadow-base2">
          {content}
        </ArkTooltip.Content>
      </ArkTooltip.Positioner>
    </ArkTooltip.Root>
  );
}
