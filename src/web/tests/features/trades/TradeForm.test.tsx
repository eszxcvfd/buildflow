/**
 * DOM-level tests for TradeForm (ORG-SRS-003, issue #26).
 * Covers: create submits code/name/description + default ACTIVE; field-level
 * validation errors; duplicate-code 409 mapped to the code field; edit sends only
 * changed fields and NEVER status (status is a separate action endpoint).
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { TradeForm } from '@/features/trades/components/TradeForm';

const routerMock = { replace: jest.fn(), push: jest.fn(), refresh: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => routerMock }));

jest.mock('@/lib/api/trades', () => ({
  __esModule: true,
  createTrade: jest.fn(),
  updateTrade: jest.fn(),
}));

import { createTrade, updateTrade, type Trade } from '@/lib/api/trades';

const createMock = createTrade as jest.Mock;
const updateMock = updateTrade as jest.Mock;

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'TR-001',
    name: 'Tho xay',
    description: null,
    status: 'ACTIVE',
    assignable: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('TradeForm (ORG-SRS-003)', () => {
  beforeEach(() => {
    createMock.mockReset();
    updateMock.mockReset();
    routerMock.push.mockClear();
  });

  afterEach(cleanup);

  it('create gửi code/name/description và status mặc định ACTIVE', async () => {
    createMock.mockResolvedValueOnce(makeTrade());
    render(<TradeForm mode="create" initial={null} />);

    fireEvent.change(screen.getByLabelText(/mã ngành nghề/i), { target: { value: 'TR-002' } });
    fireEvent.change(screen.getByLabelText(/tên ngành nghề/i), { target: { value: 'Tho son' } });
    fireEvent.click(screen.getByRole('button', { name: /tạo ngành nghề/i }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock.mock.calls[0][0]).toMatchObject({
      code: 'TR-002',
      name: 'Tho son',
      status: 'ACTIVE',
      description: null,
    });
  });

  it('create: bỏ trống code/name → field errors, không gọi API', async () => {
    render(<TradeForm mode="create" initial={null} />);
    fireEvent.click(screen.getByRole('button', { name: /tạo ngành nghề/i }));

    expect(await screen.findByText('Mã ngành nghề không được để trống')).toBeTruthy();
    expect(screen.getByText('Tên ngành nghề không được để trống')).toBeTruthy();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('create: 409 trùng mã hiển thị đúng trên field code', async () => {
    createMock.mockRejectedValueOnce({
      status: 409,
      message: 'Mã ngành nghề đã tồn tại',
      fieldErrors: { code: ['Mã ngành nghề đã tồn tại'] },
    });
    render(<TradeForm mode="create" initial={null} />);

    fireEvent.change(screen.getByLabelText(/mã ngành nghề/i), { target: { value: 'TR-001' } });
    fireEvent.change(screen.getByLabelText(/tên ngành nghề/i), { target: { value: 'Trung' } });
    fireEvent.click(screen.getByRole('button', { name: /tạo ngành nghề/i }));

    expect(await screen.findAllByText('Mã ngành nghề đã tồn tại')).toHaveLength(2); // field error code + global alert
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('create: mô tả quá 500 ký tự bị chặn client-side', async () => {
    render(<TradeForm mode="create" initial={null} />);
    fireEvent.change(screen.getByLabelText(/mã ngành nghề/i), { target: { value: 'TR-003' } });
    fireEvent.change(screen.getByLabelText(/tên ngành nghề/i), { target: { value: 'Tho' } });
    fireEvent.change(screen.getByLabelText(/mô tả/i), { target: { value: 'x'.repeat(501) } });
    fireEvent.click(screen.getByRole('button', { name: /tạo ngành nghề/i }));

    expect(await screen.findByText('Mô tả ngành nghề tối đa 500 ký tự')).toBeTruthy();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('edit: PATCH chỉ gửi field thay đổi, KHÔNG bao giờ gửi status', async () => {
    updateMock.mockResolvedValueOnce(makeTrade({ name: 'Tho xay bac cao' }));
    render(<TradeForm mode="edit" initial={makeTrade()} />);

    fireEvent.change(screen.getByLabelText(/tên ngành nghề/i), { target: { value: 'Tho xay bac cao' } });
    fireEvent.click(screen.getByRole('button', { name: /lưu thay đổi/i }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const [id, payload] = updateMock.mock.calls[0];
    expect(id).toBe('11111111-1111-4111-8111-111111111111');
    expect(payload).toMatchObject({ name: 'Tho xay bac cao' });
    expect(payload).not.toHaveProperty('status');
    // không có select trạng thái nào trong form edit
    expect(screen.queryByLabelText(/trạng thái/i)).toBeNull();
  });

  it('edit giữ nguyên mọi thứ: payload description=null không gửi status', async () => {
    updateMock.mockResolvedValueOnce(makeTrade());
    render(<TradeForm mode="edit" initial={makeTrade()} />);
    fireEvent.click(screen.getByRole('button', { name: /lưu thay đổi/i }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const payload = updateMock.mock.calls[0][1];
    expect(payload).not.toHaveProperty('status');
  });

  it('edit với initial INACTIVE vẫn KHÔNG gửi status (kích hoạt lại là action riêng)', async () => {
    updateMock.mockResolvedValueOnce(makeTrade({ status: 'INACTIVE', assignable: false }));
    render(<TradeForm mode="edit" initial={makeTrade({ status: 'INACTIVE', assignable: false })} />);

    fireEvent.change(screen.getByLabelText(/tên ngành nghề/i), { target: { value: 'Tho son' } });
    fireEvent.click(screen.getByRole('button', { name: /lưu thay đổi/i }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock.mock.calls[0][1]).toMatchObject({ name: 'Tho son' });
    expect(updateMock.mock.calls[0][1]).not.toHaveProperty('status');
  });
});
