'use client';

import { Menu as ArkMenu } from '@ark-ui/react/menu';
import { Portal } from '@ark-ui/react/portal';
import * as React from 'react';
import { cn } from '@/lib/cn';

export interface MenuItem {
  id: string;
  label: React.ReactNode;
  /** Optional href — rendered as a link item (client navigation via plain anchor). */
  href?: string;
  disabled?: boolean;
  /** Leading 16px icon rendered before the label. */
  icon?: React.ReactNode;
  /** Danger tone (vd: Đăng xuất — text-danger-600, hover bg-danger-50). */
  tone?: 'default' | 'danger';
}

export interface MenuProps {
  /** Accessible label for the trigger button. */
  triggerLabel: React.ReactNode;
  /** aria-label for the trigger when triggerLabel is not plain text. */
  triggerAriaLabel?: string;
  items: readonly MenuItem[];
  onSelect?: (id: string) => void;
  /**
   * Header section trên cùng của panel (vd: tên + email, kèm border-b).
   * Không render khi omit (giữ nguyên dropdown thường).
   */
  header?: React.ReactNode;
  /** Extra class cho panel (mặc định w-56). */
  panelClassName?: string;
  /** Extra class cho trigger (mặc định nút bordered full-width). */
  triggerClassName?: string;
}

function ChevronDownIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * DashCode stage 2 — Ark UI Menu wrapper with the DashCode dropdown shadow.
 * Link items render as anchors via `asChild` (the anchor itself carries the
 * menuitem role — no nested interactive elements); action items report
 * through `onSelect` (item-level handler, no value-mapping indirection).
 *
 * Profile polish: optional `header` (name + email, border-b), per-item 16px
 * icons, danger tone cho Đăng xuất, panel w-56, chevron trigger.
 *
 * Content luôn render qua Portal ra document.body (giống Dialog) nên khi
 * đóng, DOM của panel không nằm inline trong header — không bao giờ lộ
 * text item (vd: 'Chưa có thông báo') trong topbar.
 */
export function Menu({ triggerLabel, triggerAriaLabel, items, onSelect, header, panelClassName, triggerClassName }: MenuProps) {
  return (
    <ArkMenu.Root>
      <ArkMenu.Trigger
        aria-label={triggerAriaLabel}
        className={
          triggerClassName ??
          'inline-flex w-full items-center justify-between gap-2 rounded-[4px] border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500'
        }
      >
        <span className="min-w-0 flex-1 truncate">{triggerLabel}</span>
        {triggerClassName ? null : (
          <span aria-hidden="true" className="text-gray-400">
            <ChevronDownIcon />
          </span>
        )}
      </ArkMenu.Trigger>
      <Portal>
        <ArkMenu.Positioner>
          <ArkMenu.Content
            className={cn(
              'bf-menu-panel z-50 min-w-44 rounded-md border border-gray-200 bg-white py-1 shadow-dropdown focus:outline-none',
              panelClassName,
            )}
          >
          {header ? (
            <div className="bf-menu-header">
              {header}
            </div>
          ) : null}
          {items.map((item) => {
            const danger = item.tone === 'danger';
            const itemClass = cn(
              'flex w-full cursor-pointer items-center px-3 py-2 text-sm text-gray-800 no-underline data-[disabled]:cursor-not-allowed data-[disabled]:text-gray-400 data-[highlighted]:bg-primary-50 data-[highlighted]:text-primary-700',
              danger && 'bf-menu-item-danger',
            );
            const content = (
              <>
                {item.icon ? (
                  <span aria-hidden="true" className="bf-menu-item-icon">
                    {item.icon}
                  </span>
                ) : null}
                <span className="min-w-0 truncate">{item.label}</span>
              </>
            );
            return item.href ? (
              <ArkMenu.Item key={item.id} value={item.id} disabled={item.disabled} asChild>
                <a href={item.href} className={itemClass}>
                  {content}
                </a>
              </ArkMenu.Item>
            ) : (
              <ArkMenu.Item
                key={item.id}
                value={item.id}
                disabled={item.disabled}
                onSelect={() => onSelect?.(item.id)}
                className={itemClass}
              >
                {content}
              </ArkMenu.Item>
            );
          })}
          </ArkMenu.Content>
        </ArkMenu.Positioner>
      </Portal>
    </ArkMenu.Root>
  );
}
