import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkOrderTemplatesView } from './WorkOrderTemplatesView';
import { searchWorkOrderTemplates } from '@/lib/api/work-order-templates';
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

const searchMock = searchWorkOrderTemplates as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (listActiveWorkTypes as jest.Mock).mockResolvedValue({ data: [], total: 0 });
  (listTrades as jest.Mock).mockResolvedValue({ data: [], total: 0, limit: 100, offset: 0 });
  searchMock.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });
});

describe('WorkOrderTemplatesView PRJ-SRS-008', () => {
  it('header có nút Thêm mới; mở dialog tạo mới khi bấm', async () => {
    render(<WorkOrderTemplatesView />);
    expect(screen.getByRole('heading', { name: 'Mẫu công việc' })).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Thêm mới' }));
    expect(screen.getByText('Thêm mẫu công việc')).not.toBeNull();
    await waitFor(() =>
      expect(screen.getByLabelText('Mã mẫu công việc *')).not.toBeNull(),
    );
  });

  it('không có toggle kanban — chỉ table', async () => {
    render(<WorkOrderTemplatesView />);
    await waitFor(() =>
      expect(screen.getByText('Chưa có mẫu công việc nào phù hợp bộ lọc')).not.toBeNull(),
    );
    expect(screen.queryByRole('button', { name: /kanban/i })).toBeNull();
  });
});
