/**
 * DOM-level tests for WorkerForm (review fixes #26).
 * Covers P1-2 regression: edit does NOT re-send trades when the admin keeps the
 * current (possibly INACTIVE) trade and skill level untouched; a real change to an
 * ACTIVE trade IS sent; create still sends trades; option labels + select contents
 * (current trade option keeps initialTradeId value; only ACTIVE trades are offered
 * as alternatives).
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { WorkerForm } from '@/features/workers/components/WorkerForm';

const routerMock = { replace: jest.fn(), push: jest.fn(), refresh: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => routerMock }));

jest.mock('@/lib/api/workers', () => ({
  __esModule: true,
  createWorker: jest.fn(),
  updateWorker: jest.fn(),
  getWorker: jest.fn(),
}));

jest.mock('@/lib/api/trades', () => ({
  __esModule: true,
  listTrades: jest.fn(),
}));

// useTradeNames tải ACTIVE + INACTIVE để map id → 'code — name'; mock trả sẵn map.
const names = new Map<string, string>([
  ['11111111-1111-4111-8111-111111111111', 'TRD-001 — Xay dung'],
  ['22222222-2222-4222-8222-222222222222', 'TRD-002 — Tho son'],
]);
jest.mock('@/features/workers/hooks/useTradeNames', () => ({
  useTradeNames: () => ({ names, loading: false, failed: false }),
}));

import { createWorker, updateWorker, type Worker } from '@/lib/api/workers';
import { listTrades, type Trade } from '@/lib/api/trades';

const createMock = createWorker as jest.Mock;
const updateMock = updateWorker as jest.Mock;
const listMock = listTrades as jest.Mock;

const TRADE_ACTIVE_1 = '11111111-1111-4111-8111-111111111111';
const TRADE_ACTIVE_2 = '22222222-2222-4222-8222-222222222222';
const TRADE_INACTIVE = '33333333-3333-4333-8333-333333333333';

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: TRADE_ACTIVE_1,
    code: 'TRD-001',
    name: 'Xay dung',
    description: null,
    status: 'ACTIVE',
    assignable: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeWorker(overrides: Partial<Worker> = {}): Worker {
  return {
    id: 'w-1',
    email: 'worker@example.com',
    fullName: 'Nguyen Van A',
    phone: '0900000000',
    avatarUrl: null,
    employeeCode: 'EMP-001',
    userType: 'WORKER',
    contractorId: null,
    status: 'ACTIVE',
    eligible: true,
    trades: [{ tradeId: TRADE_ACTIVE_1, skillLevel: 3 }],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function activesOnlyList(): { data: Trade[]; total: number; limit: number; offset: number } {
  return {
    data: [makeTrade(), makeTrade({ id: TRADE_ACTIVE_2, code: 'TRD-002', name: 'Tho son' })],
    total: 2,
    limit: 100,
    offset: 0,
  };
}

async function submitEdit() {
  fireEvent.click(screen.getByRole('button', { name: /lưu thay đổi/i }));
}

describe('WorkerForm (review #26 — trades payload gating)', () => {
  beforeEach(() => {
    createMock.mockReset();
    updateMock.mockReset();
    listMock.mockReset();
    routerMock.push.mockClear();
    listMock.mockResolvedValue(activesOnlyList());
  });

  afterEach(cleanup);

  it('edit giữ nguyên trade ACTIVE (không đụng select): submit → payload KHÔNG chứa key trades', async () => {
    updateMock.mockResolvedValueOnce(makeWorker());
    render(<WorkerForm mode="edit" initial={makeWorker()} />);

    await waitFor(() => expect(listMock).toHaveBeenCalledWith({ status: 'ACTIVE', limit: 100 }));
    await submitEdit();
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const [id, payload] = updateMock.mock.calls[0];
    expect(id).toBe('w-1');
    expect(payload).not.toHaveProperty('trades');
    expect(payload).toMatchObject({ fullName: 'Nguyen Van A' });
  });

  it('edit worker giữ trade ACTIVE, chỉ đổi tên → payload không chứa trades', async () => {
    updateMock.mockResolvedValueOnce(makeWorker({ fullName: 'Nguyen Van B' }));
    render(<WorkerForm mode="edit" initial={makeWorker()} />);

    await waitFor(() => expect(listMock).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(/họ tên/i), { target: { value: 'Nguyen Van B' } });
    await submitEdit();
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const payload = updateMock.mock.calls[0][1];
    expect(payload).toMatchObject({ fullName: 'Nguyen Van B' });
    expect(payload).not.toHaveProperty('trades');
  });

  it('edit worker đang giữ trade INACTIVE (không nằm trong danh sách ACTIVE): option đầu có value=initialTradeId, chọn nó → payload không chứa trades', async () => {
    updateMock.mockResolvedValueOnce(makeWorker({ trades: [{ tradeId: TRADE_INACTIVE, skillLevel: 2 }] }));
    render(
      <WorkerForm
        mode="edit"
        initial={makeWorker({ trades: [{ tradeId: TRADE_INACTIVE, skillLevel: 2 }] })}
      />,
    );
    await waitFor(() => expect(listMock).toHaveBeenCalled());

    // options của select ngành nghề: option hiện tại + 2 ACTIVE (không option rỗng)
    const select = screen.getByLabelText(/ngành nghề \(đang hoạt động\)/i) as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).not.toContain('');
    expect(options[0]).toBe(TRADE_INACTIVE);
    expect(options).toContain(TRADE_ACTIVE_1);
    expect(options).toContain(TRADE_ACTIVE_2);
    // trade INACTIVE không bị lặp lại từ danh sách ACTIVE (vốn không có nó)
    expect(options.filter((v) => v === TRADE_INACTIVE)).toHaveLength(1);
    // label trade đã ngừng: không có trong map tên → fallback
    expect(screen.getByRole('option', { name: 'Ngành nghề hiện tại (đã ngừng hoạt động)' })).toBeTruthy();

    await submitEdit();
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock.mock.calls[0][1]).not.toHaveProperty('trades');
  });

  it('edit: đổi skill level nhưng giữ trade → payload vẫn chứa trades (skill level là một phần của assignment)', async () => {
    updateMock.mockResolvedValueOnce(makeWorker({ trades: [{ tradeId: TRADE_ACTIVE_1, skillLevel: 4 }] }));
    render(<WorkerForm mode="edit" initial={makeWorker()} />);

    await waitFor(() => expect(listMock).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(/skill lv/i), { target: { value: '4' } });
    await submitEdit();
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const payload = updateMock.mock.calls[0][1];
    expect(payload).toMatchObject({
      trades: [{ tradeId: TRADE_ACTIVE_1, skillLevel: 4 }],
    });
  });

  it('edit: chọn trade ACTIVE khác (đang ACTIVE, nằm trong danh sách) → payload chứa trades với tradeId mới', async () => {
    updateMock.mockResolvedValueOnce(makeWorker({ trades: [{ tradeId: TRADE_ACTIVE_2, skillLevel: 3 }] }));
    render(<WorkerForm mode="edit" initial={makeWorker()} />);

    await waitFor(() => expect(listMock).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(/ngành nghề/i), { target: { value: TRADE_ACTIVE_2 } });
    await submitEdit();
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock.mock.calls[0][1]).toMatchObject({
      trades: [{ tradeId: TRADE_ACTIVE_2, skillLevel: 3 }],
    });
  });

  it('edit: chọn trade ACTIVE khác + đổi skill level → payload chứa trades mới', async () => {
    updateMock.mockResolvedValueOnce(makeWorker({ trades: [{ tradeId: TRADE_ACTIVE_2, skillLevel: 5 }] }));
    render(<WorkerForm mode="edit" initial={makeWorker()} />);

    await waitFor(() => expect(listMock).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(/ngành nghề/i), { target: { value: TRADE_ACTIVE_2 } });
    fireEvent.change(screen.getByLabelText(/skill lv/i), { target: { value: '5' } });
    await submitEdit();
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock.mock.calls[0][1]).toMatchObject({
      trades: [{ tradeId: TRADE_ACTIVE_2, skillLevel: 5 }],
    });
  });

  it('create mode: trade giữ nguyên so với initial KHÔNG áp dụng — chọn trade vẫn gửi trades', async () => {
    createMock.mockResolvedValueOnce(makeWorker());
    render(<WorkerForm mode="create" initial={null} />);

    await waitFor(() => expect(listMock).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText(/mật khẩu/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/họ tên/i), { target: { value: 'Nguyen Van Moi' } });
    fireEvent.change(screen.getByLabelText(/ngành nghề/i), { target: { value: TRADE_ACTIVE_1 } });
    fireEvent.change(screen.getByLabelText(/skill lv/i), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /tạo worker/i }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock.mock.calls[0][0]).toMatchObject({
      email: 'new@example.com',
      fullName: 'Nguyen Van Moi',
      trades: [{ tradeId: TRADE_ACTIVE_1, skillLevel: 2 }],
    });
  });

  it('edit: option hiện tại (trade ACTIVE) mang label `code — name (hiện tại)` với value=initialTradeId và KHÔNG bị lặp từ danh sách ACTIVE', async () => {
    render(<WorkerForm mode="edit" initial={makeWorker()} />);
    await waitFor(() => expect(listMock).toHaveBeenCalled());

    const current = screen.getByRole('option', { name: 'TRD-001 — Xay dung (hiện tại)' }) as HTMLOptionElement;
    expect(current.value).toBe(TRADE_ACTIVE_1);
    expect((screen.getByRole('combobox', { name: /ngành nghề/i }) as HTMLSelectElement).value).toBe(TRADE_ACTIVE_1);
    // trade đang giữ không xuất hiện lần 2 như option "đang hoạt động"
    const plain = screen.queryByRole('option', { name: 'TRD-001 — Xay dung' });
    expect(plain).toBeNull();
    expect(screen.getByRole('option', { name: 'TRD-002 — Tho son' })).toBeTruthy();
  });

  it('edit với worker KHÔNG có trade: select vẫn có option rỗng "Không gán", submit không gửi trades', async () => {
    updateMock.mockResolvedValueOnce(makeWorker({ trades: [] }));
    render(<WorkerForm mode="edit" initial={makeWorker({ trades: [] })} />);

    await waitFor(() => expect(listMock).toHaveBeenCalled());
    const select = screen.getByLabelText(/ngành nghề \(đang hoạt động\)/i) as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options[0]).toBe('');
    expect(select.value).toBe('');

    await submitEdit();
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock.mock.calls[0][1]).not.toHaveProperty('trades');
  });
});
