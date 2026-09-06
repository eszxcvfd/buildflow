/**
 * DOM-level tests cho ContractorList — retry refetch (lint fix retryKey):
 * lỗi lần đầu → click "Thử lại" → gọi lại API lần 2 và render danh sách.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ContractorList } from '@/features/contractors/components/ContractorList';

jest.mock('@/lib/api/contractors', () => ({
  __esModule: true,
  listContractors: jest.fn(),
}));

import { listContractors } from '@/lib/api/contractors';

const listMock = listContractors as jest.Mock;

describe('ContractorList retry', () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('click retry sau lỗi gọi lại API lần 2 và render danh sách', async () => {
    listMock.mockRejectedValueOnce({ status: 500, message: 'Lỗi máy chủ' });
    listMock.mockResolvedValueOnce({
      data: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          code: 'CTR-001',
          name: 'Alpha Contractors',
          contactName: null,
          phone: null,
          email: null,
          status: 'ACTIVE',
          scope: null,
          eligible: true,
          createdBy: 'u-admin',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });

    render(<ContractorList />);

    const retryBtn = await screen.findByRole('button', { name: 'Thử lại' });
    expect(listMock).toHaveBeenCalledTimes(1);

    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(listMock).toHaveBeenCalledTimes(2);
    });
    await screen.findByText('Alpha Contractors');
  });
});
