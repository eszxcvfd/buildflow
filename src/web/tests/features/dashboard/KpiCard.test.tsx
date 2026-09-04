import * as React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { KpiCard } from '@/features/dashboard';

describe('KpiCard (dashboard)', () => {
  afterEach(cleanup);

  it('renders label, value and note', () => {
    render(<KpiCard label="Dự án" value="12" note="3 đang chạy" />);
    expect(screen.getByText('Dự án')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('3 đang chạy')).toBeTruthy();
  });

  it('renders placeholder value without note while loading', () => {
    render(<KpiCard label="Nhà thầu" value="…" />);
    expect(screen.getByText('Nhà thầu')).toBeTruthy();
    expect(screen.getByText('…')).toBeTruthy();
    expect(screen.queryByText(/đang chạy/)).toBeNull();
  });

  it('renders dash value with cause note on error', () => {
    render(<KpiCard label="Tài khoản" value="—" note="Cần quyền quản trị" />);
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('Cần quyền quản trị')).toBeTruthy();
  });
});
