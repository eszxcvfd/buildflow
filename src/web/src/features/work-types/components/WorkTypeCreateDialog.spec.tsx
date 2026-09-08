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
