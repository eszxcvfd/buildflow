import { render, screen, waitFor } from '@testing-library/react';
import { AppShell } from './AppShell';

const mockReplace = jest.fn();
const mockRefresh = jest.fn();
const stableRouter = { replace: mockReplace, refresh: mockRefresh };
jest.mock('next/navigation', () => ({
  useRouter: () => stableRouter,
  usePathname: () => '/crews',
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

describe('AppShell nav crews ORG-SRS-006', () => {
  it('ADMIN thấy Đội thi công', async () => {
    seedAuth(['ADMIN']);
    render(
      <AppShell>
        <p>child</p>
      </AppShell>,
    );
    await waitFor(() => expect(screen.queryByText('child')).not.toBeNull());
    const link = screen.queryByRole('link', { name: 'Đội thi công' });
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/crews');
  });

  it('PROJECT_MANAGER thấy Đội thi công (read + write crews)', async () => {
    seedAuth(['PROJECT_MANAGER']);
    render(
      <AppShell>
        <p>child</p>
      </AppShell>,
    );
    await waitFor(() => expect(screen.queryByText('child')).not.toBeNull());
    const link = screen.queryByRole('link', { name: 'Đội thi công' });
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/crews');
  });

  it('role WORKER không thấy Đội thi công', async () => {
    seedAuth(['WORKER']);
    render(
      <AppShell>
        <p>child</p>
      </AppShell>,
    );
    await waitFor(() => expect(screen.queryByText('child')).not.toBeNull());
    expect(screen.queryByRole('link', { name: 'Đội thi công' })).toBeNull();
  });
});
