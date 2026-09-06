import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CrewForm } from './CrewForm';
import { createCrew, updateCrew } from '@/lib/api/crews';
import { listWorkers } from '@/lib/api/workers';
import { listContractors } from '@/lib/api/contractors';

jest.mock('@/lib/api/crews', () => ({
  listCrews: jest.fn(),
  getCrew: jest.fn(),
  createCrew: jest.fn(),
  updateCrew: jest.fn(),
  changeCrewLifecycleStatus: jest.fn(),
  getCrewOpenWork: jest.fn(),
}));
jest.mock('@/lib/api/workers', () => ({ listWorkers: jest.fn() }));
jest.mock('@/lib/api/contractors', () => ({ listContractors: jest.fn() }));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

const createCrewMock = createCrew as jest.Mock;
const updateCrewMock = updateCrew as jest.Mock;
const listWorkersMock = listWorkers as jest.Mock;
const listContractorsMock = listContractors as jest.Mock;

function worker(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'lead@example.com',
    fullName: 'Nguyen Van Lead',
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

function initialCrew(overrides = {}) {
  return {
    id: 'crew-1',
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
  jest.useFakeTimers();
  listWorkersMock.mockResolvedValue({ data: [worker()], total: 1, limit: 100, offset: 0 });
  listContractorsMock.mockResolvedValue({ data: [], total: 0, limit: 100, offset: 0 });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('CrewForm ORG-SRS-006', () => {
  it('validation: thiếu leader chặn submit với lỗi theo field', async () => {
    render(<CrewForm mode="create" />);
    await waitFor(() => expect(listWorkersMock).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Mã đội *'), { target: { value: 'TEAM-002' } });
    fireEvent.change(screen.getByLabelText('Tên đội *'), { target: { value: 'Doi moi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo đội' }));
    await waitFor(() =>
      expect(screen.getByText('Trưởng nhóm là bắt buộc — chọn một công nhân đang hoạt động')).not.toBeNull(),
    );
    expect(createCrewMock).not.toHaveBeenCalled();
  });

  it('create thành công gửi leaderUserId + contractorId', async () => {
    createCrewMock.mockResolvedValue(initialCrew());
    render(<CrewForm mode="create" />);
    await screen.findByRole('option', { name: 'Nguyen Van Lead · NV-001' });
    fireEvent.change(screen.getByLabelText('Mã đội *'), { target: { value: 'TEAM-002' } });
    fireEvent.change(screen.getByLabelText('Tên đội *'), { target: { value: 'Doi moi' } });
    fireEvent.change(screen.getByLabelText('Trưởng nhóm *'), {
      target: { value: '11111111-1111-4111-8111-111111111111' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo đội' }));
    await waitFor(() => expect(createCrewMock).toHaveBeenCalled());
    expect(createCrewMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'TEAM-002', leaderUserId: '11111111-1111-4111-8111-111111111111' }),
    );
    await waitFor(() => expect(screen.getByText('Tạo đội thi công thành công')).not.toBeNull());
  });

  it('409 trùng code hiển thị lỗi theo field code', async () => {
    createCrewMock.mockRejectedValue({
      status: 409,
      message: 'Mã đội đã tồn tại',
      fieldErrors: { code: ['Mã đội đã tồn tại'] },
    });
    render(<CrewForm mode="create" />);
    await screen.findByRole('option', { name: 'Nguyen Van Lead · NV-001' });
    fireEvent.change(screen.getByLabelText('Mã đội *'), { target: { value: 'TEAM-001' } });
    fireEvent.change(screen.getByLabelText('Tên đội *'), { target: { value: 'Doi moi' } });
    fireEvent.change(screen.getByLabelText('Trưởng nhóm *'), {
      target: { value: '11111111-1111-4111-8111-111111111111' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo đội' }));
    await waitFor(() => expect(screen.getAllByText('Mã đội đã tồn tại')).toHaveLength(2));
    // lỗi gắn đúng field code (class bf-field-error), không chỉ banner chung
    expect(document.querySelector('.bf-field-error')).not.toBeNull();
  });

  it('edit giữ leader hiện tại làm default; đổi lead cần xác nhận', async () => {
    const other = worker({ id: 'other-lead-id', fullName: 'Tran Van Khac', employeeCode: 'NV-002' });
    listWorkersMock.mockResolvedValue({ data: [worker(), other], total: 2, limit: 100, offset: 0 });
    updateCrewMock.mockResolvedValue(initialCrew());
    render(<CrewForm mode="edit" initial={initialCrew()} />);
    await screen.findByRole('option', { name: 'Nguyen Van Lead · NV-001' });
    // default giữ leader hiện tại
    expect((screen.getByLabelText('Trưởng nhóm *') as HTMLSelectElement).value).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
    // đổi sang người khác → hiện confirm, chưa gọi API
    fireEvent.change(screen.getByLabelText('Trưởng nhóm *'), { target: { value: 'other-lead-id' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(screen.getByText(/Xác nhận đổi trưởng nhóm của đội?/)).not.toBeNull());
    expect(updateCrewMock).not.toHaveBeenCalled();
    // xác nhận → gọi API với leader mới
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đổi trưởng nhóm' }));
    await waitFor(() => expect(updateCrewMock).toHaveBeenCalledWith('crew-1', expect.objectContaining({ leaderUserId: 'other-lead-id' })));
  });

  it('edit cảnh báo khi leader hiện tại không còn ACTIVE', async () => {
    listWorkersMock.mockResolvedValue({ data: [], total: 0, limit: 100, offset: 0 });
    render(<CrewForm mode="edit" initial={initialCrew()} />);
    await screen.findByText(/Trưởng nhóm hiện tại không còn hoạt động/);
  });

  it('leader selector lọc text phía client', async () => {
    const other = worker({ id: 'other-lead-id', fullName: 'Tran Van Khac', employeeCode: 'NV-002' });
    listWorkersMock.mockResolvedValue({ data: [worker(), other], total: 2, limit: 100, offset: 0 });
    render(<CrewForm mode="create" />);
    await screen.findByRole('option', { name: 'Nguyen Van Lead · NV-001' });
    fireEvent.change(screen.getByLabelText('Tìm trưởng nhóm'), { target: { value: 'Tran Van' } });
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Tran Van Khac · NV-002' })).not.toBeNull(),
    );
    expect(screen.queryByRole('option', { name: 'Nguyen Van Lead · NV-001' })).toBeNull();
  });
});
