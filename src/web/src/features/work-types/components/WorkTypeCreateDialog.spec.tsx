import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkTypeCreateDialog } from './WorkTypeCreateDialog';
import { createWorkType } from '@/lib/api/work-types';
import { listTrades } from '@/lib/api/trades';

jest.mock('@/lib/api/work-types', () => ({
  searchWorkTypes: jest.fn(),
  listActiveWorkTypes: jest.fn(),
  getWorkType: jest.fn(),
  createWorkType: jest.fn(),
  updateWorkType: jest.fn(),
  changeWorkTypeStatus: jest.fn(),
}));
jest.mock('@/lib/api/trades', () => ({ listTrades: jest.fn() }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }));

const createMock = createWorkType as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (listTrades as jest.Mock).mockResolvedValue({ data: [], total: 0, limit: 100, offset: 0 });
});

describe('WorkTypeCreateDialog PRJ-SRS-004', () => {
  it('validate trống + thêm/xóa dòng requiredFields + submit tạo mới', async () => {
    const onCreated = jest.fn();
    const onClose = jest.fn();
    createMock.mockResolvedValue({ id: 'new-id' });
    render(<WorkTypeCreateDialog open onClose={onClose} onCreated={onCreated} />);

    await userEvent.click(screen.getByRole('button', { name: 'Tạo loại công việc' }));
    expect(await screen.findByText('Mã loại công việc không được để trống')).not.toBeNull();

    await userEvent.type(screen.getByLabelText('Mã loại công việc *'), 'WT-001');
    await userEvent.type(screen.getByLabelText('Tên loại công việc *'), 'Do be tong');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm trường dữ liệu' }));
    expect(screen.getByLabelText('Dòng 1: key')).not.toBeNull();

    // Xóa dòng vừa thêm rồi submit → tạo mới không kèm requiredFields
    await userEvent.click(screen.getByRole('button', { name: 'Xóa' }));
    expect(screen.queryByLabelText('Dòng 1: key')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Tạo loại công việc' }));
    await waitFor(() => expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'WT-001', name: 'Do be tong' }),
    ));
    expect(onCreated).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('preview hiển thị trực tiếp + validate/gửi thời lượng và ưu tiên', async () => {
    createMock.mockResolvedValue({ id: 'new-id' });
    render(<WorkTypeCreateDialog open onClose={jest.fn()} />);

    // Panel xem trước render ngay với giá trị mặc định
    expect(screen.getByText('Xem trước cấu hình')).not.toBeNull();

    await userEvent.type(screen.getByLabelText('Mã loại công việc *'), 'WT-002');
    await userEvent.type(screen.getByLabelText('Tên loại công việc *'), 'Xay tuong');
    await userEvent.type(screen.getByLabelText('Thời lượng mặc định (phút)'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo loại công việc' }));
    expect(await screen.findByText('Thời lượng mặc định phải là số nguyên dương (phút)')).not.toBeNull();
    expect(createMock).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText('Thời lượng mặc định (phút)'));
    await userEvent.type(screen.getByLabelText('Thời lượng mặc định (phút)'), '120');
    await userEvent.selectOptions(screen.getByLabelText('Ưu tiên mặc định'), 'HIGH');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo loại công việc' }));
    await waitFor(() => expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ defaultDurationMinutes: 120, defaultPriority: 'HIGH' }),
    ));
    // Preview cập nhật theo nội dung đang nhập
    expect(screen.getByText('120 phút')).not.toBeNull();
    expect(screen.getAllByText('Cao').length).toBeGreaterThanOrEqual(1);
  });

  it('409 trùng code hiển thị lỗi theo field', async () => {
    createMock.mockRejectedValue({
      status: 409,
      message: 'Mã loại công việc đã tồn tại',
      fieldErrors: { code: ['Mã loại công việc đã tồn tại'] },
    });
    render(<WorkTypeCreateDialog open onClose={jest.fn()} />);
    await userEvent.type(screen.getByLabelText('Mã loại công việc *'), 'WT-001');
    await userEvent.type(screen.getByLabelText('Tên loại công việc *'), 'Ten khac');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo loại công việc' }));
    expect((await screen.findAllByText('Mã loại công việc đã tồn tại')).length).toBeGreaterThanOrEqual(1);
  });
});
