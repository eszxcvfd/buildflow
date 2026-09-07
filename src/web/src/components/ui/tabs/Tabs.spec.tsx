import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs } from './Tabs';

const ITEMS = [
  { value: 'workers', label: 'Công nhân' },
  { value: 'contractors', label: 'Nhà thầu' },
  { value: 'crews', label: 'Đội' },
];

describe('Tabs wrapper (Ark UI)', () => {
  it('renders a labelled tablist with selectable tabs', () => {
    render(<Tabs value="workers" items={ITEMS} onChange={jest.fn()} aria-label="Loại nguồn lực" />);
    expect(screen.getByRole('tablist', { name: 'Loại nguồn lực' })).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Công nhân' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Nhà thầu' }).getAttribute('aria-selected')).toBe('false');
  });

  it('clicking a tab reports its value', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Tabs value="workers" items={ITEMS} onChange={onChange} aria-label="Loại nguồn lực" />);
    await user.click(screen.getByRole('tab', { name: 'Đội' }));
    expect(onChange).toHaveBeenCalledWith('crews');
  });

  it('disables opted-out tabs', () => {
    render(
      <Tabs
        value="workers"
        items={[...ITEMS, { value: 'archived', label: 'Lưu trữ', disabled: true }]}
        onChange={jest.fn()}
        aria-label="Loại nguồn lực"
      />,
    );
    expect(screen.getByRole('tab', { name: 'Lưu trữ' }).hasAttribute('disabled')).toBe(true);
  });

  // NOTE: arrow-key roaming (zag tabs) does not move focus inside jsdom
  // (verified against raw Ark Tabs: click selection works, ArrowRight never
  // shifts focus — same limitation class as Menu item activation). The wrapper
  // keeps Ark's roving-tabindex wiring; verify arrow navigation in a real
  // browser (see /resources tab row).
});
