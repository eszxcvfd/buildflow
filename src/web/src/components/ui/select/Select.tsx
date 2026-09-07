'use client';

import { Select as ArkSelect, createListCollection } from '@ark-ui/react/select';
import * as React from 'react';
import { cn } from '@/lib/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  id?: string;
  label?: React.ReactNode;
  /** Ẩn label khỏi mắt thường nhưng giữ accessible name (toolbar gọn). */
  hideLabel?: boolean;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-describedby'?: string;
  className?: string;
  /** Name for the hidden native select (form submission); omit when controlled-only. */
  name?: string;
}

/**
 * DashCode stage 2 — Ark UI Select wrapper styled like a DashCode input.
 * Value-based `onChange` mirrors the native-select semantics the migrated
 * callers (ResourceDirectory, ProjectForm) relied on. When `name` is set, a
 * hidden native select keeps form-submission semantics.
 */
export function Select({
  id,
  label,
  hideLabel,
  value,
  options,
  onChange,
  placeholder = '— Chọn —',
  disabled,
  name,
  className,
  ...aria
}: SelectProps) {
  const collection = React.useMemo(
    () => createListCollection({ items: options.map((o) => ({ ...o })) }),
    [options],
  );
  const invalid = aria['aria-invalid'] === true || aria['aria-invalid'] === 'true';

  return (
    <ArkSelect.Root
      ids={id ? { trigger: id } : undefined}
      collection={collection}
      value={value ? [value] : []}
      onValueChange={(details) => onChange(details.value[0] ?? '')}
      disabled={disabled}
      positioning={{ sameWidth: true }}
    >
      {label ? (
        <ArkSelect.Label
          className={cn(
            'bf-label mb-1 block text-sm font-medium text-gray-800',
            hideLabel && 'bf-sr-only',
          )}
        >
          {label}
        </ArkSelect.Label>
      ) : null}
      <ArkSelect.Control>
        <ArkSelect.Trigger
          aria-describedby={aria['aria-describedby']}
          className={cn(
            'bf-input',
            'flex w-full items-center justify-between gap-2 rounded-[4px] border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm',
            'focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500',
            'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400',
            invalid && 'border-danger-500 focus:border-danger-500 focus:ring-danger-500',
            className,
          )}
        >
          <ArkSelect.ValueText placeholder={placeholder} className="truncate data-[placeholder]:text-gray-400" />
          <ArkSelect.Indicator aria-hidden="true" className="text-gray-400">
            ▾
          </ArkSelect.Indicator>
        </ArkSelect.Trigger>
      </ArkSelect.Control>
      <ArkSelect.Positioner>
        <ArkSelect.Content className="z-50 max-h-64 overflow-y-auto rounded-[4px] border border-gray-200 bg-white py-1 shadow-dropdown focus:outline-none">
          {collection.items.map((item) => (
            <ArkSelect.Item
              key={item.value}
              item={item}
              className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm text-gray-800 data-[disabled]:cursor-not-allowed data-[disabled]:text-gray-400 data-[highlighted]:bg-primary-50 data-[state=checked]:bg-primary-50 data-[state=checked]:font-medium data-[state=checked]:text-primary-700"
            >
              <ArkSelect.ItemText>{item.label}</ArkSelect.ItemText>
              <ArkSelect.ItemIndicator aria-hidden="true" className="text-primary-600">
                ✓
              </ArkSelect.ItemIndicator>
            </ArkSelect.Item>
          ))}
        </ArkSelect.Content>
      </ArkSelect.Positioner>
      {name ? <ArkSelect.HiddenSelect name={name} /> : null}
    </ArkSelect.Root>
  );
}
