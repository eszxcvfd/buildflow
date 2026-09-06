import { render, screen, waitFor } from '@testing-library/react';
import { AppShell } from './AppShell';

const mockReplace = jest.fn();
const mockRefresh = jest.fn();
const stableRouter = { replace: mockReplace, refresh: mockRefresh };
jest.mock('next/navigation', () => ({
  useRouter: () => stableRouter,
  usePathname: () => '/dashboard',
}));

function seedAuth(codes: string[]) {
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
});

describe('AppShell nav ORG-SRS-005 (issue #28)', () => {
  it('ADMIN thấy Tra cứu nguồn lực + các mục admin', async () => {
    seedAuth(['ADMIN']);
    render(
      <AppShell>
        <p>child</p>
      </AppShell>,
    );
    await waitFor(() => expect(screen.queryByText('child')).not.toBeNull());
    expect(screen.queryByRole('link', { name: 'Tra cứu nguồn lực' })).not.toBeNull();
    expect(screen.queryByRole('link', { name: 'Công nhân' })).not.toBeNull();
    expect(screen.queryByRole('link', { name: 'Ngành nghề' })).not.toBeNull();
    expect(screen.queryByRole('link', { name: 'Tài khoản' })).not.toBeNull();
  });

  it('PROJECT_MANAGER thấy Tra cứu nguồn lực, không thấy mục admin-only', async () => {
    seedAuth(['PROJECT_MANAGER']);
    render(
      <AppShell>
        <p>child</p>
      </AppShell>,
    );
    await waitFor(() => expect(screen.queryByText('child')).not.toBeNull());
    expect(screen.queryByRole('link', { name: 'Tra cứu nguồn lực' })).not.toBeNull();
    expect(screen.queryByRole('link', { name: 'Nhà thầu' })).not.toBeNull();
    expect(screen.queryByRole('link', { name: 'Công nhân' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ngành nghề' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Tài khoản' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Nhật ký thao tác' })).toBeNull();
  });

  it('role WORKER không thấy Tra cứu nguồn lực', async () => {
    seedAuth(['WORKER']);
    render(
      <AppShell>
        <p>child</p>
      </AppShell>,
    );
    await waitFor(() => expect(screen.queryByText('child')).not.toBeNull());
    expect(screen.queryByRole('link', { name: 'Tra cứu nguồn lực' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Nhà thầu' })).not.toBeNull();
  });

  it('alias project_role (MANAGER/COORDINATOR/PM) và role lạ không thấy Tra cứu nguồn lực', async () => {
    for (const codes of [['MANAGER'], ['COORDINATOR'], ['PM'], ['STAFF'], ['RANDOM_CODE']]) {
      window.localStorage.clear();
      seedAuth(codes);
      const { unmount } = render(
        <AppShell>
          <p>child</p>
        </AppShell>,
      );
      await waitFor(() => expect(screen.queryByText('child')).not.toBeNull());
      expect(screen.queryByRole('link', { name: 'Tra cứu nguồn lực' })).toBeNull();
      unmount();
    }
  });
});
