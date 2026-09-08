import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkTypesView } from './WorkTypesView';
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
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }));

const searchMock = searchWorkTypes as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (listTrades as jest.Mock).mockResolvedValue({ data: [], total: 0, limit: 100, offset: 0 });
  searchMock.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });
});

describe('WorkTypesView PRJ-SRS-004', () => {
  it('header có nút Thêm mới; mở dialog tạo mới khi bấm', async () => {
    render(<WorkTypesView />);
    expect(screen.getByRole('heading', { name: 'Loại công việc' })).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Thêm mới' }));
    expect(screen.getByText('Thêm loại công việc')).not.toBeNull();
    await waitFor(() =>
      expect(screen.getByLabelText('Mã loại công việc *')).not.toBeNull(),
    );
  });

  it('không có toggle kanban — chỉ table', async () => {
    render(<WorkTypesView />);
    await waitFor(() =>
      expect(screen.getByText('Chưa có loại công việc nào phù hợp bộ lọc')).not.toBeNull(),
    );
    expect(screen.queryByRole('button', { name: /kanban/i })).toBeNull();
  });
});
