import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Menu } from './Menu';

const ITEMS = [
  { id: 'profile', label: 'Hồ sơ cá nhân', href: '/profile' },
  { id: 'logout', label: 'Đăng xuất' },
] as const;

describe('Menu wrapper (Ark UI)', () => {
  it('opens on trigger click showing labelled menuitems', async () => {
    const user = userEvent.setup();
    render(<Menu triggerLabel="Tài khoản" triggerAriaLabel="Mở menu tài khoản" items={[...ITEMS]} />);
    await user.click(screen.getByRole('button', { name: 'Mở menu tài khoản' }));
    expect(await screen.findByRole('menuitem', { name: 'Hồ sơ cá nhân' })).not.toBeNull();
    expect(await screen.findByRole('menuitem', { name: 'Đăng xuất' })).not.toBeNull();
  });

  it('link item renders as an anchor menuitem (asChild, no nested <a>)', async () => {
    const user = userEvent.setup();
    render(<Menu triggerLabel="Tài khoản" triggerAriaLabel="Mở menu tài khoản" items={[...ITEMS]} />);
    await user.click(screen.getByRole('button', { name: 'Mở menu tài khoản' }));
    const item = await screen.findByRole('menuitem', { name: 'Hồ sơ cá nhân' });
    expect(item.tagName).toBe('A');
    expect(item.getAttribute('href')).toBe('/profile');
    expect(item.querySelector('a')).toBeNull();
  });

  it('Escape closes the menu', async () => {
    const user = userEvent.setup();
    render(<Menu triggerLabel="Tài khoản" triggerAriaLabel="Mở menu tài khoản" items={[...ITEMS]} />);
    await user.click(screen.getByRole('button', { name: 'Mở menu tài khoản' }));
    await screen.findByRole('menuitem', { name: 'Đăng xuất' });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('menuitem', { name: 'Đăng xuất' })).toBeNull(),
    );
  });

  // NOTE: item activation (onSelect) is not asserted here — zag menu's
  // pointer/keyboard activation path does not fire inside jsdom (verified
  // against raw Ark Menu: open/close work, selection never dispatches).
  // The wrapper wires the documented item-level `onSelect`; verify
  // activation in a real browser (see AppShell profile menu).
});
