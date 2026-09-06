import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResourceDirectory } from './ResourceDirectory';
import { listWorkers } from '@/lib/api/workers';
import { listContractors } from '@/lib/api/contractors';
import { listTrades } from '@/lib/api/trades';
import { useCanViewResourceDirectory } from '@/lib/auth/roles';

jest.mock('@/lib/api/workers', () => ({ listWorkers: jest.fn() }));
jest.mock('@/lib/api/contractors', () => ({ listContractors: jest.fn() }));
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
const listTradesMock = listTrades as jest.Mock;
const canViewMock = useCanViewResourceDirectory as jest.Mock;

function worker(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'w@example.com',
    fullName: 'Nguyen Van W',
    phone: '+84901234567',
    avatarUrl: null,
    employeeCode: 'NV-001',
    userType: 'WORKER',
    contractorId: null,
    status: 'ACTIVE',
    trades: [{ tradeId: 't-trade-1', skillLevel: 3 }],
    eligible: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function contractor(overrides = {}) {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    code: 'CTR-001',
    name: 'Alpha Contractor',
    contactName: 'Nguyen Van A',
    phone: '+84901234567',
    email: 'a@example.com',
    status: 'ACTIVE',
    scope: 'Thi cong phan tho',
    eligible: true,
    createdBy: 'u-admin',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function trade() {
  return {
    id: 't-trade-1',
    code: 'EL',
    name: 'Dien',
    description: null,
    status: 'ACTIVE',
    assignable: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery = '';
  canViewMock.mockReturnValue(true);
  listTradesMock.mockResolvedValue({ data: [trade()], total: 1, limit: 100, offset: 0 });
  listWorkersMock.mockResolvedValue({ data: [worker()], total: 1, limit: 20, offset: 0 });
  listContractorsMock.mockResolvedValue({ data: [contractor()], total: 1, limit: 20, offset: 0 });
});

describe('ResourceDirectory ORG-SRS-005 (issue #28)', () => {
  it('gọi listWorkers với sort/order/limit/offset và render capability/status + link detail', async () => {
    render(<ResourceDirectory />);
    expect(await screen.findByText('Nguyen Van W')).toBeTruthy();
    expect(listWorkersMock).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'createdAt', order: 'desc', limit: 20, offset: 0 }),
    );
    expect(screen.getByText(/Đủ điều kiện phân công/)).toBeTruthy();
    expect(screen.getByText(/EL — Dien · Lv3/)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Chi tiết' });
    expect(link.getAttribute('href')).toBe('/workers/11111111-1111-4111-8111-111111111111');
  });

  it('đổi nhanh 3 filter liên tiếp (không chờ re-render) → URL cuối chứa CẢ 3 param', async () => {
    render(<ResourceDirectory />);
    await screen.findByText('Nguyen Van W');
    // Không chờ re-render / không cập nhật mockQuery giữa các lần — mô phỏng
    // router.replace async chưa kịp đổi URL (race S2 gốc).
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'ACTIVE' } });
    fireEvent.change(screen.getByLabelText('Ngành nghề'), { target: { value: 't-trade-1' } });
    fireEvent.change(screen.getByLabelText('Cấp kỹ năng'), { target: { value: '3' } });
    expect(mockReplace).toHaveBeenCalledTimes(3);
    const lastUrl = mockReplace.mock.calls[mockReplace.mock.calls.length - 1][0] as string;
    expect(lastUrl).toContain('status=ACTIVE');
    expect(lastUrl).toContain('trade=t-trade-1');
    expect(lastUrl).toContain('skill=3');
  });

  it('đổi tab reset page=1', async () => {
    mockQuery = 'tab=workers&status=ACTIVE&page=2';
    render(<ResourceDirectory />);
    await screen.findByText('Nguyen Van W');
    fireEvent.click(screen.getByRole('tab', { name: 'Nhà thầu' }));
    const url = mockReplace.mock.calls[mockReplace.mock.calls.length - 1][0] as string;
    expect(url).toContain('tab=contractors');
    expect(url).not.toContain('page=');
  });

  it('không loop: apply cùng giá trị liên tiếp không gọi replace thừa', async () => {
    render(<ResourceDirectory />);
    await screen.findByText('Nguyen Van W');
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'ACTIVE' } });
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'ACTIVE' } });
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('đổi sort/order sync vào URL; query gửi đúng API', async () => {
    mockQuery = 'sort=name&order=asc';
    render(<ResourceDirectory />);
    await screen.findByText('Nguyen Van W');
    expect(listWorkersMock).toHaveBeenCalledWith(expect.objectContaining({ sort: 'name', order: 'asc' }));
    fireEvent.change(screen.getByLabelText('Sắp xếp'), { target: { value: 'createdAt' } });
    expect(mockReplace).toHaveBeenLastCalledWith(expect.stringContaining('sort=createdAt'), expect.anything());
  });

  it('pagination: tổng lớn → chuyển trang qua URL, offset đúng', async () => {
    listWorkersMock.mockResolvedValue({ data: [worker()], total: 45, limit: 20, offset: 0 });
    const { unmount } = render(<ResourceDirectory />);
    await screen.findByText('Trang 1/3');
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(mockReplace).toHaveBeenLastCalledWith(expect.stringContaining('page=2'), expect.anything());
    unmount();
    mockQuery = 'page=2';
    listWorkersMock.mockResolvedValue({ data: [worker()], total: 45, limit: 20, offset: 20 });
    render(<ResourceDirectory />);
    await screen.findByText('Trang 2/3');
    expect(listWorkersMock).toHaveBeenCalledWith(expect.objectContaining({ offset: 20 }));
  });

  it('empty state kèm gợi ý đổi filter + nút xóa bộ lọc', async () => {
    mockQuery = 'status=INACTIVE';
    listWorkersMock.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });
    render(<ResourceDirectory />);
    expect(await screen.findByText('Chưa có công nhân nào phù hợp bộ lọc')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    const url = mockReplace.mock.calls[mockReplace.mock.calls.length - 1][0] as string;
    expect(url).not.toContain('status=');
  });

  it('giữ filter khi quay lại: giá trị từ URL query hiển thị lại sau remount', async () => {
    mockQuery = 'status=INACTIVE&sort=name&order=asc';
    const { unmount } = render(<ResourceDirectory />);
    await screen.findByText('Nguyen Van W');
    expect((screen.getByLabelText('Trạng thái') as HTMLSelectElement).value).toBe('INACTIVE');
    expect((screen.getByLabelText('Sắp xếp') as HTMLSelectElement).value).toBe('name');
    unmount();
    render(<ResourceDirectory />);
    await screen.findByText('Nguyen Van W');
    expect((screen.getByLabelText('Trạng thái') as HTMLSelectElement).value).toBe('INACTIVE');
  });

  it('role không phép → 403 card, không gọi API', async () => {
    canViewMock.mockReturnValue(false);
    render(<ResourceDirectory />);
    expect(await screen.findByText(/cần vai trò ADMIN hoặc PROJECT_MANAGER \(403\)/)).toBeTruthy();
    expect(listWorkersMock).not.toHaveBeenCalled();
  });

  it('API 403 → permission card + retry gọi lại', async () => {
    listWorkersMock.mockRejectedValueOnce({ status: 403, message: 'Forbidden' });
    render(<ResourceDirectory />);
    expect(await screen.findByText(/cần vai trò ADMIN hoặc PROJECT_MANAGER \(403\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(listWorkersMock).toHaveBeenCalledTimes(2));
  });

  it('API 400 fieldErrors → lỗi hiển thị theo field, giữ giá trị filter', async () => {
    mockQuery = 'status=ACTIVE&skill=3';
    listWorkersMock.mockRejectedValue({
      status: 400,
      message: 'Skill level phải là 1-5',
      fieldErrors: { skillLevel: ['Skill level phải là 1-5'] },
    });
    render(<ResourceDirectory />);
    expect((await screen.findByRole('alert')).textContent).toContain('Skill level phải là 1-5');
    expect((screen.getByLabelText('Trạng thái') as HTMLSelectElement).value).toBe('ACTIVE');
    expect((screen.getByLabelText('Cấp kỹ năng') as HTMLSelectElement).value).toBe('3');
  });

  it('tab Nhà thầu: chuyển tab qua URL, gọi listContractors, row đủ contact/status/scope', async () => {
    render(<ResourceDirectory />);
    await screen.findByText('Nguyen Van W');
    fireEvent.click(screen.getByRole('tab', { name: 'Nhà thầu' }));
    expect(mockReplace).toHaveBeenLastCalledWith(expect.stringContaining('tab=contractors'), expect.anything());
    mockQuery = 'tab=contractors';
    render(<ResourceDirectory />);
    expect(await screen.findByText('Alpha Contractor')).toBeTruthy();
    expect(listContractorsMock).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'createdAt', order: 'desc', limit: 20, offset: 0 }),
    );
    expect(screen.getByText(/Thi cong phan tho/)).toBeTruthy();
  });

  it('tab Đội disabled với note ORG-SRS-006', async () => {
    render(<ResourceDirectory />);
    await screen.findByText('Nguyen Van W');
    const teamTab = screen.getByRole('tab', { name: 'Đội' });
    expect((teamTab as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Tab Đội: Sắp có — ORG-SRS-006')).toBeTruthy();
  });
});
