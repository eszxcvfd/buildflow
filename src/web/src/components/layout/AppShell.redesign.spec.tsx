import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AppShell } from './AppShell';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockRefresh = jest.fn();
const stableRouter = { replace: mockReplace, push: mockPush, refresh: mockRefresh };
let mockPathname = '/dashboard';
jest.mock('next/navigation', () => ({
  useRouter: () => stableRouter,
  usePathname: () => mockPathname,
}));

function seedAuth(codes: string[] = ['ADMIN']) {
  window.localStorage.setItem(
    'buildflow.auth.v1',
    JSON.stringify({
      accessToken: 'jwt-test',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      user: { id: 'u-1', email: 't@example.com', fullName: 'Test User', status: 'ACTIVE', userType: 'STAFF' },
      roles: codes.map((c, i) => ({ id: `r-${i}`, code: c, name: c })),
      projectIds: [],
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  mockPathname = '/dashboard';
});

describe('AppShell web redesign (shell + full-bleed)', () => {
  it('breadcrumb hiển thị nhóm + trang hiện tại', async () => {
    seedAuth();
    render(
      <AppShell>
        <p>child</p>
      </AppShell>,
    );
    await waitFor(() => expect(screen.queryByText('child')).not.toBeNull());
    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumb).getByText('Điều hành')).not.toBeNull();
    expect(within(crumb).getByText('Tổng quan')).not.toBeNull();
  });

  it('⌘K mở palette tìm kiếm', async () => {
    seedAuth();
    render(
      <AppShell>
        <p>child</p>
      </AppShell>,
    );
    await waitFor(() => expect(screen.queryByText('child')).not.toBeNull());
    expect(screen.queryByPlaceholderText(/Tìm tên, mã, trang/)).toBeNull();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    await waitFor(() => expect(screen.queryByPlaceholderText(/Tìm tên, mã, trang/)).not.toBeNull());
  });

  it("data-fullbleed='true' IFF pathname === '/projects' (exact, F007)", async () => {
    seedAuth();
    for (const [path, expected] of [
      ['/projects', 'true'],
      ['/projects/abc-uuid', 'false'],
      ['/projects/new', 'false'],
      ['/dashboard', 'false'],
    ] as Array<[string, string]>) {
      mockPathname = path;
      const { unmount } = render(
        <AppShell>
          <p>child-{path}</p>
        </AppShell>,
      );
      await waitFor(() => expect(screen.queryByText(`child-${path}`)).not.toBeNull());
      expect(document.querySelector('.bf-shell')?.getAttribute('data-fullbleed')).toBe(expected);
      unmount();
    }
  });

  it('footer sidebar hiển thị tên + nhãn vai trò trung thực', async () => {
    seedAuth(['ADMIN']);
    render(
      <AppShell>
        <p>child</p>
      </AppShell>,
    );
    await waitFor(() => expect(screen.queryByText('child')).not.toBeNull());
    const footer = document.querySelector('.bf-nav-user');
    expect(footer).not.toBeNull();
    expect(within(footer as HTMLElement).getByText('Test User')).not.toBeNull();
    expect(within(footer as HTMLElement).getByText('Quản trị viên')).not.toBeNull();
  });

  it('role-gating giữ behavior cũ: WORKER chỉ thấy nhóm Điều hành', async () => {
    seedAuth(['WORKER']);
    render(
      <AppShell>
        <p>child</p>
      </AppShell>,
    );
    await waitFor(() => expect(screen.queryByText('child')).not.toBeNull());
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    // Nhóm Điều hành không gate — mọi user đã đăng nhập đều thấy.
    expect(within(nav).getByText('Điều hành')).not.toBeNull();
    expect(within(nav).getByText('Dự án')).not.toBeNull();
    // adminOnly/resourceViewer items ẩn với role lạ (fail-closed, behavior cũ).
    expect(within(nav).queryByText('Công nhân')).toBeNull();
    expect(within(nav).queryByText('Tài khoản')).toBeNull();
    expect(within(nav).queryByText('Nguồn lực')).toBeNull();
    expect(within(nav).queryByText('Quản trị')).toBeNull();
  });

  it('collapse persist: bf.sidebar.collapsed=1 → data-collapsed (behavior cũ)', async () => {
    seedAuth();
    window.localStorage.setItem('bf.sidebar.collapsed', '1');
    render(
      <AppShell>
        <p>child</p>
      </AppShell>,
    );
    await waitFor(() => expect(screen.queryByText('child')).not.toBeNull());
    await waitFor(() =>
      expect(document.querySelector('.bf-shell')?.getAttribute('data-collapsed')).toBe('true'),
    );
  });
});
