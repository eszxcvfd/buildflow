import { render, screen, waitFor } from '@testing-library/react';
import { ProjectDetail } from './ProjectDetail';
import { getProject } from '@/lib/api/projects';
import { listWorkers } from '@/lib/api/workers';

jest.mock('@/lib/api/projects', () => ({
  listProjects: jest.fn(),
  getProject: jest.fn(),
  createProject: jest.fn(),
  updateProject: jest.fn(),
}));
jest.mock('@/lib/api/workers', () => ({ listWorkers: jest.fn() }));

const getProjectMock = getProject as jest.Mock;
const listWorkersMock = listWorkers as jest.Mock;

function project(overrides = {}) {
  return {
    id: 'p-1',
    code: 'PRJ-001',
    name: 'Du an 1',
    status: 'DRAFT',
    managerId: '11111111-1111-4111-8111-111111111111',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

function setSessionRoles(codes: string[]) {
  window.localStorage.setItem(
    'buildflow.auth.v1',
    JSON.stringify({
      accessToken: 'token',
      expiresAt: '2099-01-01T00:00:00.000Z',
      user: { id: 'u-1', email: 'a@b.c', fullName: 'A', status: 'ACTIVE', userType: 'STAFF' },
      roles: codes.map((code, i) => ({ id: `r-${i}`, code, name: code })),
      projectIds: [],
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  getProjectMock.mockResolvedValue(project());
  listWorkersMock.mockResolvedValue({ data: [], total: 0, limit: 100, offset: 0 });
});

describe('ProjectDetail PRJ-SRS-001 (issue #32)', () => {
  it('render profile: code/name/status badge/ngày + note vòng đời PRJ-SRS-002', async () => {
    setSessionRoles(['ADMIN']);
    render(<ProjectDetail id="p-1" />);
    await waitFor(() => expect(screen.getAllByText('PRJ-001').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Du an 1').length).toBeGreaterThan(0);
    expect(screen.getByText('DRAFT')).not.toBeNull();
    expect(screen.getByText(/Vòng đời dự án — PRJ-SRS-002/)).not.toBeNull();
  });

  it('ADMIN thấy link Sửa hồ sơ', async () => {
    setSessionRoles(['ADMIN']);
    render(<ProjectDetail id="p-1" />);
    await waitFor(() => expect(screen.getAllByText('PRJ-001').length).toBeGreaterThan(0));
    const link = screen.getByRole('link', { name: 'Sửa hồ sơ' });
    expect(link.getAttribute('href')).toBe('/projects/p-1/edit');
  });

  it('PROJECT_MANAGER thấy link Sửa hồ sơ', async () => {
    setSessionRoles(['PROJECT_MANAGER']);
    render(<ProjectDetail id="p-1" />);
    await waitFor(() => expect(screen.getAllByText('PRJ-001').length).toBeGreaterThan(0));
    expect(screen.getByRole('link', { name: 'Sửa hồ sơ' })).not.toBeNull();
  });

  it('WORKER không thấy link Sửa hồ sơ (fail-closed)', async () => {
    setSessionRoles(['WORKER']);
    render(<ProjectDetail id="p-1" />);
    await waitFor(() => expect(screen.getAllByText('PRJ-001').length).toBeGreaterThan(0));
    expect(screen.queryByRole('link', { name: 'Sửa hồ sơ' })).toBeNull();
  });

  it('404 hiển thị not-found', async () => {
    setSessionRoles(['ADMIN']);
    getProjectMock.mockRejectedValue({ status: 404, message: 'Not found' });
    render(<ProjectDetail id="missing" />);
    await waitFor(() => expect(screen.getByText(/Không tìm thấy dự án \(404\)/)).not.toBeNull());
  });
});
