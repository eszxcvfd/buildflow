import { render, screen, waitFor } from '@testing-library/react';
import { WorkTypesList } from './WorkTypesList';
import { searchWorkTypes } from '@/lib/api/work-types';
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

const searchMock = searchWorkTypes as jest.Mock;
const listTradesMock = listTrades as jest.Mock;

function wt(overrides = {}) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    code: 'WT-001',
    name: 'Do be tong',
    description: null,
    group: 'Ket cau',
    requiredTradeId: null,
    requiredFields: [{ key: 'photos', label: 'Anh hien truong', type: 'PHOTO' }],
    configVersion: 1,
    defaultDurationMinutes: null,
    defaultPriority: 'NORMAL',
    status: 'ACTIVE',
    isActive: true,
    usableForNewWorkOrder: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  listTradesMock.mockResolvedValue({ data: [], total: 0, limit: 100, offset: 0 });
});

describe('WorkTypesList PRJ-SRS-004', () => {
  it('hiển thị loading rồi rows table (tên + code chip / nhóm / dữ liệu bắt buộc / badge)', async () => {
    searchMock.mockResolvedValue({ data: [wt()], total: 1, limit: 20, offset: 0 });
    render(<WorkTypesList />);
    expect(screen.getByText('Đang tải danh sách loại công việc…')).not.toBeNull();
    await waitFor(() => expect(screen.getByText('Do be tong')).not.toBeNull());
    expect(screen.getByText('WT-001')).not.toBeNull();
    expect(screen.getByText('Ket cau')).not.toBeNull();
    expect(screen.getByText('Anh hien truong')).not.toBeNull();
    expect(screen.getByText('ACTIVE')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Chi tiết' })).not.toBeNull();
  });

  it('dữ liệu bắt buộc nhiều field hiển thị dạng label +n', async () => {
    searchMock.mockResolvedValue({
      data: [
        wt({
          requiredFields: [
            { key: 'a', label: 'Truong A', type: 'TEXT' },
            { key: 'b', label: 'Truong B', type: 'NUMBER' },
            { key: 'c', label: 'Truong C', type: 'DATE' },
          ],
        }),
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });
    render(<WorkTypesList />);
    await waitFor(() => expect(screen.getByText('Truong A +2')).not.toBeNull());
  });

  it('empty state khi không có loại phù hợp', async () => {
    searchMock.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });
    render(<WorkTypesList />);
    await waitFor(() =>
      expect(screen.getByText('Chưa có loại công việc nào phù hợp bộ lọc')).not.toBeNull(),
    );
  });

  it('403 hiển thị thiếu quyền + nút thử lại', async () => {
    searchMock.mockRejectedValue({ status: 403, message: 'Forbidden' });
    render(<WorkTypesList />);
    await waitFor(() =>
      expect(screen.getByText('Không có quyền truy cập — cần ADMIN hoặc Điều phối (403)')).not.toBeNull(),
    );
    expect(screen.getByRole('button', { name: 'Thử lại' })).not.toBeNull();
  });
});
