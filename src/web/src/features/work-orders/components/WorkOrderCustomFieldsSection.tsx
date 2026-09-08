'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input/Input';
import type { RequiredField } from '@/lib/api/work-types';

function booleanSelectValue(raw: string): string {
  const t = (raw ?? '').trim().toLowerCase();
  if (t === 'true' || t === '1') return 'true';
  if (t === 'false' || t === '0') return 'false';
  return '';
}

/**
 * J8 — khu "Dữ liệu bổ sung (theo loại công việc)": render ô nhập từ
 * `workType.required_fields` (NUMBER/TEXT/DATE/BOOLEAN/SELECT/PHOTO→ô URL
 * văn bản). Giá trị thô dạng chuỗi (`Record<key, string>`); caller map sang
 * payload qua `toCustomFieldsPayload`. `fields` rỗng → render null.
 */
export function WorkOrderCustomFieldsSection({
  fields,
  values,
  disabled,
  onChange,
  fieldErrors,
  idPrefix,
}: {
  fields: RequiredField[];
  values: Record<string, string>;
  disabled?: boolean;
  onChange: (key: string, value: string) => void;
  fieldErrors?: Record<string, string[]>;
  idPrefix: string;
}) {
  if (!fields || fields.length === 0) return null;
  return (
    <fieldset style={{ display: 'grid', gap: '0.75rem', border: 0, padding: 0, margin: 0 }}>
      <legend className="bf-label" style={{ padding: 0 }}>
        Dữ liệu bổ sung (theo loại công việc)
      </legend>
      {fields.map((f) => {
        const type = String(f.type ?? 'TEXT').toUpperCase();
        const id = `${idPrefix}-${f.key}`;
        const raw = values[f.key] ?? '';
        const err = fieldErrors?.[f.key]?.join(' ') ?? fieldErrors?.customFields?.join(' ') ?? null;
        const requiredMark = f.required === false ? null : ' *';
        const label = `${f.label ?? f.key}${requiredMark}`;
        if (type === 'BOOLEAN') {
          return (
            <div className="bf-field" key={f.key}>
              <label className="bf-label" htmlFor={id}>
                {label}
              </label>
              <select
                id={id}
                className="bf-input"
                value={booleanSelectValue(raw)}
                onChange={(e) => onChange(f.key, e.target.value)}
                aria-invalid={Boolean(err)}
                disabled={disabled}
              >
                <option value="">— Chưa chọn —</option>
                <option value="true">Có</option>
                <option value="false">Không</option>
              </select>
              {err ? (
                <p className="bf-field-error" role="alert">
                  {err}
                </p>
              ) : null}
            </div>
          );
        }
        if (type === 'SELECT') {
          return (
            <div className="bf-field" key={f.key}>
              <label className="bf-label" htmlFor={id}>
                {label}
              </label>
              <select
                id={id}
                className="bf-input"
                value={raw}
                onChange={(e) => onChange(f.key, e.target.value)}
                aria-invalid={Boolean(err)}
                disabled={disabled}
              >
                <option value="">— Chọn giá trị —</option>
                {(f.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {err ? (
                <p className="bf-field-error" role="alert">
                  {err}
                </p>
              ) : null}
            </div>
          );
        }
        if (type === 'DATE') {
          return (
            <div className="bf-field" key={f.key}>
              <label className="bf-label" htmlFor={id}>
                {label}
              </label>
              <Input
                id={id}
                type="date"
                value={raw}
                onChange={(e) => onChange(f.key, e.target.value)}
                hasError={Boolean(err)}
                disabled={disabled}
              />
              {err ? (
                <p className="bf-field-error" role="alert">
                  {err}
                </p>
              ) : null}
            </div>
          );
        }
        return (
          <div className="bf-field" key={f.key}>
            <label className="bf-label" htmlFor={id}>
              {label}
            </label>
            <Input
              id={id}
              value={raw}
              onChange={(e) => onChange(f.key, e.target.value)}
              hasError={Boolean(err)}
              placeholder={
                type === 'NUMBER'
                  ? 'Nhập số'
                  : type === 'PHOTO'
                    ? 'https://… (URL ảnh nghiệm thu)'
                    : `Nhập ${f.label ?? f.key}`
              }
              inputMode={type === 'NUMBER' ? 'decimal' : undefined}
              disabled={disabled}
            />
            {err ? (
              <p className="bf-field-error" role="alert">
                {err}
              </p>
            ) : null}
          </div>
        );
      })}
    </fieldset>
  );
}
