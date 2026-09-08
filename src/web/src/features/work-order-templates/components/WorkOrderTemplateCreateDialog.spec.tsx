import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkOrderTemplateCreateDialog } from './WorkOrderTemplateCreateDialog';
import { createWorkOrderTemplate } from '@/lib/api/work-order-templates';
import { listActiveWorkTypes } from '@/lib/api/work-types';
import { listTrades } from '@/lib/api/trades';

jest.mock('@/lib/api/work-order-templates', () => ({
  searchWorkOrderTemplates: jest.fn(),
  listActiveWorkOrderTemplates: jest.fn(),
  getWorkOrderTemplate: jest.fn(),
  createWorkOrderTemplate: jest.fn(),
  updateWorkOrderTemplate: jest.fn(),
  changeWorkOrderTemplateStatus: jest.fn(),
}));
jest.mock('@/lib/api/work-types', () => ({ listActiveWorkTypes: jest.fn() }));
jest.mock('@/lib/api/trades', () => ({ listTrades: jest.fn() }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }));

const createMock = createWorkOrderTemplate as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (listActiveWorkTypes as jest.Mock).mockResolvedValue({ data: [], total: 0 });
  (listTrades as jest.Mock).mockResolvedValue({ data: [], total: 0, limit: 100, offset: 0 });
});

describe('WorkOrderTemplateCreateDialog PRJ-SRS-008', () => {
  it('validate trống + thêm/xóa dòng kỹ năng và checklist + submit tạo mới', async () => {
    const onCreated = jest.fn();
    const onClose = jest.fn();
    createMock.mockResolvedValue({ id: 'new-id' });
    render(<WorkOrderTemplateCreateDialog open onClose={onClose} onCreated={onCreated} />);

    await userEvent.click(screen.getByRole('button', { name: 'Tạo mẫu công việc' }));
    expect(await screen.findByText('Mã mẫu công việc không được để trống')).not.toBeNull();

    await userEvent.type(screen.getByLabelText('Mã mẫu công việc *'), 'WOT-001');
    await userEvent.type(screen.getByLabelText('Tên mẫu công việc *'), 'Do be tong chuan');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm kỹ năng' }));
    expect(screen.getByLabelText('Kỹ năng 1: code')).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Thêm mục checklist' }));
    expect(screen.getByLabelText('Checklist mục 1: tiêu đề')).not.toBeNull();

    // Xóa các dòng vừa thêm rồi submit → tạo mới không kèm skills/checklist
    const deleteButtons = screen.getAllByRole('button', { name: 'Xóa' });
    for (const b of deleteButtons) await userEvent.click(b);
    expect(screen.queryByLabelText('Kỹ năng 1: code')).toBeNull();
    expect(screen.queryByLabelText('Checklist mục 1: tiêu đề')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Tạo mẫu công việc' }));
    await waitFor(() => expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'WOT-001', name: 'Do be tong chuan' }),
    ));
    expect(onCreated).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('preview hiển thị trực tiếp + validate/gửi thời lượng và ưu tiên', async () => {
    createMock.mockResolvedValue({ id: 'new-id' });
    render(<WorkOrderTemplateCreateDialog open onClose={jest.fn()} />);

    // Panel xem trước render ngay với giá trị mặc định
    expect(screen.getByText('Xem trước cấu hình')).not.toBeNull();

    await userEvent.type(screen.getByLabelText('Mã mẫu công việc *'), 'WOT-002');
    await userEvent.type(screen.getByLabelText('Tên mẫu công việc *'), 'Xay tuong chuan');
    await userEvent.type(screen.getByLabelText('Thời lượng mặc định (phút)'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo mẫu công việc' }));
    expect(await screen.findByText('Thời lượng mặc định phải là số nguyên dương (phút)')).not.toBeNull();
    expect(createMock).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText('Thời lượng mặc định (phút)'));
    await userEvent.type(screen.getByLabelText('Thời lượng mặc định (phút)'), '120');
    await userEvent.selectOptions(screen.getByLabelText('Ưu tiên mặc định'), 'HIGH');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo mẫu công việc' }));
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
      message: 'Mã mẫu công việc đã tồn tại',
      fieldErrors: { code: ['Mã mẫu công việc đã tồn tại'] },
    });
    render(<WorkOrderTemplateCreateDialog open onClose={jest.fn()} />);
    await userEvent.type(screen.getByLabelText('Mã mẫu công việc *'), 'WOT-001');
    await userEvent.type(screen.getByLabelText('Tên mẫu công việc *'), 'Ten khac');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo mẫu công việc' }));
    expect((await screen.findAllByText('Mã mẫu công việc đã tồn tại')).length).toBeGreaterThanOrEqual(1);
  });
});
