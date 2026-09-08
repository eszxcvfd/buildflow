import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkTypeEditDialog } from './WorkTypeEditDialog';
import { getWorkType, updateWorkType } from '@/lib/api/work-types';
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
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: mockRefresh }) }));

const getMock = getWorkType as jest.Mock;
const updateMock = updateWorkType as jest.Mock;

function wt() {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    code: 'WT-001',
    name: 'Do be tong',
    description: 'Mo ta',
    group: 'Ket cau',
    requiredTradeId: null,
    requiredFields: [{ key: 'photos', label: 'Anh hien truong', type: 'PHOTO' }],
    configVersion: 3,
    defaultDurationMinutes: null,
    defaultPriority: 'NORMAL',
    status: 'ACTIVE',
    isActive: true,
    usableForNewWorkOrder: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (listTrades as jest.Mock).mockResolvedValue({ data: [], total: 0, limit: 100, offset: 0 });
});

describe('WorkTypeEditDialog PRJ-SRS-004', () => {
  it('prefill đủ fields incl. requiredFields builder + gửi expectedConfigVersion', async () => {
    getMock.mockResolvedValue(wt());
    updateMock.mockResolvedValue({ workType: wt(), versionChanged: false });
    const onUpdated = jest.fn();
    render(<WorkTypeEditDialog id="44444444-4444-4444-8444-444444444444" open onClose={jest.fn()} onUpdated={onUpdated} />);

    await waitFor(() => expect(screen.getByLabelText('Mã loại công việc *')).not.toBeNull());
    expect((screen.getByLabelText('Mã loại công việc *') as HTMLInputElement).value).toBe('WT-001');
    expect((screen.getByLabelText('Tên loại công việc *') as HTMLInputElement).value).toBe('Do be tong');
    expect((screen.getByLabelText('Dòng 1: key') as HTMLInputElement).value).toBe('photos');

    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith(
      '44444444-4444-4444-8444-444444444444',
      expect.objectContaining({ expectedConfigVersion: 3 }),
    ));
    expect(onUpdated).toHaveBeenCalled();
  });

  it('prefill thời lượng/ưu tiên + preview trạng thái + gửi kèm payload', async () => {
    getMock.mockResolvedValue({ ...wt(), defaultDurationMinutes: 90, defaultPriority: 'URGENT' });
    updateMock.mockResolvedValue({ workType: wt(), versionChanged: true });
    render(<WorkTypeEditDialog id="44444444-4444-4444-8444-444444444444" open onClose={jest.fn()} />);

    await waitFor(() => expect(screen.getByLabelText('Thời lượng mặc định (phút)')).not.toBeNull());
    expect((screen.getByLabelText('Thời lượng mặc định (phút)') as HTMLInputElement).value).toBe('90');
    expect((screen.getByLabelText('Ưu tiên mặc định') as HTMLSelectElement).value).toBe('URGENT');
    expect(screen.getByText('Xem trước cấu hình')).not.toBeNull();
    expect(screen.getByText('90 phút')).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith(
      '44444444-4444-4444-8444-444444444444',
      expect.objectContaining({ defaultDurationMinutes: 90, defaultPriority: 'URGENT', expectedConfigVersion: 3 }),
    ));
  });

  it('409 conflict hiển thị notice + nút tải lại', async () => {
    getMock.mockResolvedValue(wt());
    updateMock.mockRejectedValue({
      status: 409,
      code: 'WORK_TYPE_CONFIG_CONFLICT',
      message: 'Cấu hình đã được người khác cập nhật — tải lại',
      fieldErrors: { expectedConfigVersion: ['Cấu hình đã được người khác cập nhật — tải lại'] },
    });
    render(<WorkTypeEditDialog id="44444444-4444-4444-8444-444444444444" open onClose={jest.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('Mã loại công việc *')).not.toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect((await screen.findAllByText(/Cấu hình đã được người khác cập nhật/)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: 'Tải lại' }).length).toBeGreaterThanOrEqual(2);
  });
});
