'use client';

import { Tabs as ArkTabs } from '@ark-ui/react/tabs';
import * as React from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  /** Controlled selected tab value. */
  value: string;
  items: readonly TabItem[];
  onChange: (value: string) => void;
  /** Accessible label for the tablist. */
  'aria-label'?: string;
  className?: string;
}

/**
 * DashCode stage 3 — Ark UI Tabs wrapper. Selected state is styled from the
 * controlled `value` (accent border, matching the previous `.bf-btn` tab row)
 * so visuals never depend on zag internals; Ark owns role=tablist/tab,
 * aria-selected, and arrow-key navigation.
 */
export function Tabs({ value, items, onChange, className, ...aria }: TabsProps) {
  return (
    <ArkTabs.Root
      value={value}
      onValueChange={(details) => onChange(details.value)}
      className={className}
    >
      <ArkTabs.List aria-label={aria['aria-label']} className="flex flex-wrap gap-2">
        {items.map((item) => (
          <ArkTabs.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={cn(
              'bf-btn',
              'inline-flex items-center justify-center gap-2 rounded-[4px] px-4 py-2 text-sm font-medium',
              'border border-gray-300 bg-white text-gray-800 shadow-sm',
              'transition-colors duration-100 hover:bg-gray-50',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500',
              'disabled:cursor-not-allowed disabled:opacity-60',
              'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60',
              item.value === value && 'bf-tab-active',
            )}
            style={item.value === value ? { borderColor: 'var(--bf-accent)' } : undefined}
          >
            {item.label}
          </ArkTabs.Trigger>
        ))}
      </ArkTabs.List>
    </ArkTabs.Root>
  );
}
