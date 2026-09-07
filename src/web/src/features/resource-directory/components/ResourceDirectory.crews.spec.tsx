import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResourceDirectory } from './ResourceDirectory';
import { listWorkers } from '@/lib/api/workers';
import { listContractors } from '@/lib/api/contractors';
import { listCrews } from '@/lib/api/crews';
import { listTrades } from '@/lib/api/trades';
import { useCanViewResourceDirectory } from '@/lib/auth/roles';

jest.mock('@/lib/api/workers', () => ({ listWorkers: jest.fn() }));
jest.mock('@/lib/api/contractors', () => ({ listContractors: jest.fn() }));
jest.mock('@/lib/api/crews', () => ({ listCrews: jest.fn() }));
jest.mock('@/lib/api/trades', () => ({ listTrades: jest.fn() }));
jest.mock('@/lib/auth/roles', () => ({ useCanViewResourceDirectory: jest.fn() }));

const mockReplace = jest.fn();
let mockQuery = '';
const cachedParams: { q: string; sp: URLSearchParams } = { q: '###unset###', sp: new URLSearchParams('') };
function mockSearchParams(): URLSearchParams {
  if (cachedParams.q !== mockQuery) {
    cachedParams.q = mockQuery;
    cachedParams.sp = new URLSearchParams(mockQuery);
  }
  return cachedParams.sp;
}
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/resources',
  useSearchParams: () => mockSearchParams(),
}));

const listWorkersMock = listWorkers as jest.Mock;
const listContractorsMock = listContractors as jest.Mock;
const listCrewsMock = listCrews as jest.Mock;
const listTradesMock = listTrades as jest.Mock;
const canViewMock = useCanViewResourceDirectory as jest.Mock;

function crew(overrides = {}) {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    code: 'TEAM-001',
    name: 'Doi ket cau',
    description: null,
    contractorId: null,
    status: 'ACTIVE',
    eligible: true,
    leaderUserId: '11111111-1111-4111-8111-111111111111',
    createdBy: 'u-admin',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery = '';
  canViewMock.mockReturnValue(true);
  listTradesMock.mockResolvedValue({ data: [], total: 0, limit: 100, offset: 0 });
  listWorkersMock.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });
  listContractorsMock.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });
  listCrewsMock.mockResolvedValue({ data: [crew()], total: 1, limit: 20, offset: 0 });
});

describe('ResourceDirectory crews tab ORG-SRS-006', () => {
  it('tab Đội khả dụng và hiển thị rows code + tên + status + eligible + trưởng nhóm', async () => {
    mockQuery = 'tab=crews';
    render(<ResourceDirectory />);
    const crewsTab = screen.getByRole('tab', { name: 'Đội' });
    expect((crewsTab as HTMLButtonElement).disabled).toBe(false);
    await waitFor(() => expect(listCrewsMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Doi ket cau')).not.toBeNull());
    expect(screen.getByText('TEAM-001')).not.toBeNull();
    expect(screen.getByText('Đủ điều kiện phân công')).not.toBeNull();
    expect(screen.getByText('Trưởng nhóm')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Chi tiết' }).getAttribute('href')).toBe(
      '/crews/33333333-3333-4333-8333-333333333333',
    );
  });

  it('tab crews qua URL param đọc listCrews với sort/pagination', async () => {
    mockQuery = 'tab=crews&sort=name&order=asc';
    render(<ResourceDirectory />);
    await waitFor(() => expect(listCrewsMock).toHaveBeenCalled());
    expect(listCrewsMock).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'name', order: 'asc', limit: 20, offset: 0 }),
    );
  });

  it('empty crews kèm gợi ý đổi filter', async () => {
    mockQuery = 'tab=crews';
    listCrewsMock.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });
    render(<ResourceDirectory />);
    await waitFor(() =>
      expect(screen.getByText('Chưa có đội thi công nào phù hợp bộ lọc')).not.toBeNull(),
    );
  });
});
