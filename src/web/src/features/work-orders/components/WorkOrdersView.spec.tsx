import { render, screen, waitFor } from '@testing-library/react';
import { WorkOrdersView } from './WorkOrdersView';
import { searchWorkOrders } from '@/lib/api/work-orders';

jest.mock('@/lib/api/work-orders', () => ({
  searchWorkOrders: jest.fn(),
  getWorkOrder: jest.fn(),
  createWorkOrder: jest.fn(),
  updateWorkOrder: jest.fn(),
  newCorrelationId: jest.fn(() => 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'),
}));

const searchMock = searchWorkOrders as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  searchMock.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });
});

describe('WorkOrdersView', () => {
  it('render PageHeader Công việc + list (deep-link props truyền xuống)', async () => {
    render(<WorkOrdersView initialProjectId="p-1" initialStatus="DRAFT" />);
    expect(screen.getByText('Công việc')).not.toBeNull();
    await waitFor(() => expect(searchMock).toHaveBeenCalled());
    expect(searchMock).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'p-1', status: 'DRAFT' }),
    );
  });
});
