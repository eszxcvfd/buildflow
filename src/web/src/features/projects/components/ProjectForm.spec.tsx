import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectForm } from './ProjectForm';
import { createProject, updateProject } from '@/lib/api/projects';
import { listWorkers } from '@/lib/api/workers';

jest.mock('@/lib/api/projects', () => ({
  listProjects: jest.fn(),
  getProject: jest.fn(),
  createProject: jest.fn(),
  updateProject: jest.fn(),
}));
jest.mock('@/lib/api/workers', () => ({ listWorkers: jest.fn() }));

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}));

const createProjectMock = createProject as jest.Mock;
const updateProjectMock = updateProject as jest.Mock;
const listWorkersMock = listWorkers as jest.Mock;

function worker(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'manager@example.com',
    fullName: 'Nguyen Van Quan Ly',
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

function initialProject(overrides = {}) {
  return {
    id: 'p-1',
    code: 'PRJ-001',
    name: 'Du an 1',
    status: 'DRAFT',
    managerId: '11111111-1111-4111-8111-111111111111',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function fillCreateForm() {
  fireEvent.change(screen.getByLabelText('Mã dự án *'), { target: { value: 'PRJ-002' } });
  fireEvent.change(screen.getByLabelText('Tên dự án *'), { target: { value: 'Du an 2' } });
  fireEvent.change(screen.getByLabelText('Địa chỉ *'), { target: { value: 'So 2, duong B' } });
  fireEvent.change(screen.getByLabelText('Ngày bắt đầu kế hoạch *'), { target: { value: '2026-02-01' } });
  fireEvent.change(screen.getByLabelText('Ngày kết thúc kế hoạch *'), { target: { value: '2026-11-30' } });
  fireEvent.change(screen.getByLabelText('Quản lý dự án *'), {
    target: { value: '11111111-1111-4111-8111-111111111111' },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  listWorkersMock.mockResolvedValue({ data: [worker()], total: 1, limit: 100, offset: 0 });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ProjectForm PRJ-SRS-001 (issue #32)', () => {
  it('create happy: gửi đúng payload (code/name/address/dates/manager + timezone mặc định)', async () => {
    createProjectMock.mockResolvedValue({ id: 'p-2', status: 'DRAFT' });
    render(<ProjectForm mode="create" />);
    await waitFor(() => expect(listWorkersMock).toHaveBeenCalled());
    fillCreateForm();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo dự án' }));
    await waitFor(() => expect(createProjectMock).toHaveBeenCalled());
    expect(createProjectMock).toHaveBeenCalledWith({
      code: 'PRJ-002',
      name: 'Du an 2',
      address: 'So 2, duong B',
      plannedStartDate: '2026-02-01',
      plannedEndDate: '2026-11-30',
      managerId: '11111111-1111-4111-8111-111111111111',
      description: null,
      timezone: 'Asia/Ho_Chi_Minh',
    });
  });

  it('create validation: end < start chặn submit ở client', async () => {
    render(<ProjectForm mode="create" />);
    await waitFor(() => expect(listWorkersMock).toHaveBeenCalled());
    fillCreateForm();
    fireEvent.change(screen.getByLabelText('Ngày kết thúc kế hoạch *'), { target: { value: '2026-01-15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo dự án' }));
    await waitFor(() =>
      expect(screen.getByText('Ngày kết thúc kế hoạch phải từ ngày bắt đầu trở đi')).not.toBeNull(),
    );
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it('409 trùng mã → lỗi theo field code', async () => {
    createProjectMock.mockRejectedValue({
      status: 409,
      message: 'Mã dự án đã tồn tại',
      code: 'PROJECT_CODE_DUPLICATE',
      fieldErrors: { code: ['Mã dự án đã tồn tại'] },
    });
    render(<ProjectForm mode="create" />);
    await waitFor(() => expect(listWorkersMock).toHaveBeenCalled());
    fillCreateForm();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo dự án' }));
    await waitFor(() => expect(screen.getAllByText('Mã dự án đã tồn tại').length).toBeGreaterThanOrEqual(2));
  });

  it('403 → thông báo quyền ADMIN/PROJECT_MANAGER', async () => {
    createProjectMock.mockRejectedValue({ status: 403, message: 'Forbidden' });
    render(<ProjectForm mode="create" />);
    await waitFor(() => expect(listWorkersMock).toHaveBeenCalled());
    fillCreateForm();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo dự án' }));
    await waitFor(() => expect(screen.getByText('Cần ADMIN hoặc PROJECT_MANAGER')).not.toBeNull());
  });

  it('edit: prefill qua getProject summary, code disabled + hint, payload bỏ code', async () => {
    updateProjectMock.mockResolvedValue({ id: 'p-1', status: 'DRAFT' });
    render(<ProjectForm mode="edit" initial={initialProject()} />);
    await waitFor(() => expect(listWorkersMock).toHaveBeenCalled());
    const codeInput = screen.getByLabelText('Mã dự án *') as HTMLInputElement;
    expect(codeInput.disabled).toBe(true);
    expect(codeInput.value).toBe('PRJ-001');
    expect(screen.getByText('Mã dự án không thể đổi sau khi tạo.')).not.toBeNull();
    expect((screen.getByLabelText('Tên dự án *') as HTMLInputElement).value).toBe('Du an 1');
    fireEvent.change(screen.getByLabelText('Tên dự án *'), { target: { value: 'Du an 1 doi ten' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(updateProjectMock).toHaveBeenCalled());
    const [id, payload] = updateProjectMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(id).toBe('p-1');
    expect(payload).not.toHaveProperty('code');
    expect(payload).not.toHaveProperty('status');
    expect(payload.name).toBe('Du an 1 doi ten');
  });
});
