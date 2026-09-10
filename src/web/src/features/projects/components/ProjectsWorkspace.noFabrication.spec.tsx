import { render, screen, waitFor } from '@testing-library/react';
import { ProjectsView } from '@/features/projects/components/ProjectsView';
import { FORBIDDEN_LITERALS } from '@/features/projects/lib/forbiddenLiterals';
import { listProjects } from '@/lib/api/projects';

/**
 * AC6 — chống fabrication: workspace /projects render không chứa literal
 * giả của mẫu (số liệu %, tỷ, tên/avatar giả). Mọi ô phải là field API
 * thật hoặc placeholder '—'/empty-state trung thực.
 */
jest.mock('@/lib/api/projects', () => ({
  listProjects: jest.fn(),
  getProject: jest.fn(),
  listProjectAreas: jest.fn().mockRejectedValue({ status: 500, message: 'no areas' }),
  listProjectMembers: jest.fn().mockResolvedValue({ data: [], total: 0 }),
}));
jest.mock('@/lib/api/workers', () => ({ listWorkers: jest.fn().mockResolvedValue({ data: [] }) }));
jest.mock('@/lib/auth/roles', () => {
  const actual = jest.requireActual('@/lib/auth/roles');
  return { ...actual, useCanManageProjects: jest.fn(() => true) };
});
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), refresh: jest.fn() }),
}));

const FORBIDDEN: readonly string[] = FORBIDDEN_LITERALS;

describe('AC6 anti-fabrication (/projects workspace)', () => {
  it('không render literal giả của mẫu', async () => {
    (listProjects as jest.Mock).mockResolvedValue([
      { id: 'pra', code: 'PRA', name: 'Trung tam A', status: 'ACTIVE', managerId: 'm-1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z' },
      { id: 'prc', code: 'PRC', name: 'Nha may C', status: 'DRAFT', managerId: 'm-2', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z' },
    ]);
    render(<ProjectsView />);
    await waitFor(() => expect(screen.getByText('Trung tam A')).not.toBeNull());
    const body = document.body.textContent ?? '';
    for (const lit of FORBIDDEN) {
      expect(body).not.toContain(lit);
    }
    // Placeholder trung thực tồn tại.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
