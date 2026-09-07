import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

/** Ark Select interaction (DashCode stage 2): open + choose by visible label. */
async function selectOption(label: string, optionName: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: optionName }));
}

const CREW_ID = '33333333-3333-4333-8333-333333333333';

function crew(overrides = {}) {
  return {
    id: CREW_ID,
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

function worker(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'w@example.com',
    fullName: 'Nguyen Van W',
    phone: null,
    avatarUrl: null,
    employeeCode: 'NV-001',
    userType: 'WORKER',
    contractorId: null,
    status: 'ACTIVE',
    trades: [],
    eligible: true,
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
  listWorkersMock.mockResolvedValue({ data: [worker()], total: 1, limit: 20, offset: 0 });
  listContractorsMock.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });
  // Tab crews + select lọc đội đều dùng listCrews; mock trả ACTIVE cho cả hai.
  listCrewsMock.mockImplementation(async (params: { status?: string }) => {
    if (params?.status === 'ACTIVE') return { data: [crew()], total: 1, limit: 100, offset: 0 };
    return { data: [crew()], total: 1, limit: 20, offset: 0 };
  });
});

describe('ResourceDirectory team filter ORG-SRS-007 (issue #30, D9)', () => {
  it('tab workers có select Đội thi công với options crews ACTIVE', async () => {
    const user = userEvent.setup();
    render(<ResourceDirectory />);
    await screen.findByText('Nguyen Van W');
    expect(screen.getByRole('combobox', { name: 'Đội thi công' })).not.toBeNull();
    await user.click(screen.getByRole('combobox', { name: 'Đội thi công' }));
    expect(await screen.findByRole('option', { name: 'Doi ket cau · TEAM-001' })).not.toBeNull();
    expect(listCrewsMock).toHaveBeenCalledWith({ status: 'ACTIVE', limit: 100 });
  });

  it('đổi đội → URL sync ?crew= + reset page 1', async () => {
    mockQuery = 'tab=workers&page=2';
    render(<ResourceDirectory />);
    await screen.findByText('Nguyen Van W');
    await selectOption('Đội thi công', 'Doi ket cau · TEAM-001');
    const url = mockReplace.mock.calls[mockReplace.mock.calls.length - 1][0] as string;
    expect(url).toContain(`crew=${CREW_ID}`);
    expect(url).not.toContain('page=');
  });

  it('?crew= trong URL → listWorkers nhận crewId + select giữ giá trị', async () => {
    mockQuery = `tab=workers&crew=${CREW_ID}`;
    render(<ResourceDirectory />);
    await screen.findByText('Nguyen Van W');
    expect(listWorkersMock).toHaveBeenCalledWith(expect.objectContaining({ crewId: CREW_ID }));
    expect(screen.getByRole('combobox', { name: 'Đội thi công' }).textContent).toContain(
      'Doi ket cau · TEAM-001',
    );
  });

  it('xóa bộ lọc gỡ ?crew=', async () => {
    mockQuery = `tab=workers&crew=${CREW_ID}`;
    render(<ResourceDirectory />);
    await screen.findByText('Nguyen Van W');
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    const url = mockReplace.mock.calls[mockReplace.mock.calls.length - 1][0] as string;
    expect(url).not.toContain('crew=');
  });

  it('tab crews không có select lọc đội (chỉ tab workers)', async () => {
    mockQuery = 'tab=crews';
    render(<ResourceDirectory />);
    await waitFor(() => expect(listCrewsMock).toHaveBeenCalled());
    expect(screen.queryByRole('combobox', { name: 'Đội thi công' })).toBeNull();
  });
});
