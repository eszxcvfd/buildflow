import { render, screen, waitFor } from '@testing-library/react';
import { ProjectWorkOrders } from './ProjectWorkOrders';
import { searchWorkOrders } from '@/lib/api/work-orders';

jest.mock('@/lib/api/work-orders', () => ({
  searchWorkOrders: jest.fn(),
  getWorkOrder: jest.fn(),
  createWorkOrder: jest.fn(),
  updateWorkOrder: jest.fn(),
  newCorrelationId: jest.fn(() => 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'),
}));

const searchMock = searchWorkOrders as jest.Mock;
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ProjectWorkOrders', () => {
  it('đếm rẻ limit 1 → hiện tổng + link deep-link ?projectId=', async () => {
    searchMock.mockResolvedValue({ data: [], total: 3, limit: 1, offset: 0 });
    render(<ProjectWorkOrders projectId={PROJECT_ID} />);
    await waitFor(() => expect(screen.getByText('Dự án này có 3 công việc.')).not.toBeNull());
    expect(searchMock).toHaveBeenCalledWith({ projectId: PROJECT_ID, limit: 1, offset: 0 });
    expect(screen.getByRole('link', { name: 'Xem tất cả công việc' }).getAttribute('href')).toBe(
      `/work-orders?projectId=${PROJECT_ID}`,
    );
  });

  it('total 0 → message chưa có công việc, vẫn có link', async () => {
    searchMock.mockResolvedValue({ data: [], total: 0, limit: 1, offset: 0 });
    render(<ProjectWorkOrders projectId={PROJECT_ID} />);
    await waitFor(() => expect(screen.getByText('Dự án này chưa có công việc nào.')).not.toBeNull());
    expect(screen.getByRole('link', { name: 'Xem tất cả công việc' })).not.toBeNull();
  });

  it('lỗi đếm → fail-soft, vẫn hiện link', async () => {
    searchMock.mockRejectedValueOnce({ status: 500, message: 'Lỗi' });
    render(<ProjectWorkOrders projectId={PROJECT_ID} />);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Xem tất cả công việc' })).not.toBeNull(),
    );
  });
});
