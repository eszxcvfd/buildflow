/**
 * DOM-level tests cho ContractorForm (ORG-SRS-002, fix #25 + lifecycle #27).
 * Covers: edit PATCH payload — status giữ nguyên thì OMIT status; #27: kể cả khi
 * đổi status trên select, PATCH hồ sơ KHÔNG BAO GIỜ gửi status (lifecycle đi qua
 * dialog ở màn chi tiết) mà chỉ hiện ghi chú hướng dẫn; create vẫn gửi status.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ContractorForm } from '@/features/contractors/components/ContractorForm';

const routerMock = { replace: jest.fn(), push: jest.fn(), refresh: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => routerMock }));

jest.mock('@/lib/api/contractors', () => ({
  __esModule: true,
  createContractor: jest.fn(),
  updateContractor: jest.fn(),
}));

import { createContractor, updateContractor, type Contractor } from '@/lib/api/contractors';

const createMock = createContractor as jest.Mock;
const updateMock = updateContractor as jest.Mock;

function makeContractor(overrides: Partial<Contractor> = {}): Contractor {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'CTR-001',
    name: 'Alpha',
    contactName: 'Nguyen Van A',
    phone: '+84901234567',
    email: 'a@example.com',
    status: 'ACTIVE',
    scope: 'Thi cong phan tho',
    eligible: true,
    createdBy: 'u-admin',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ContractorForm (ORG-SRS-002 #25)', () => {
  beforeEach(() => {
    createMock.mockReset();
    updateMock.mockReset();
    routerMock.push.mockClear();
  });

  afterEach(cleanup);

  it('edit giữ nguyên status: PATCH payload KHÔNG chứa status, vẫn đổi contact/scope', async () => {
    updateMock.mockResolvedValueOnce({ ...makeContractor(), contactName: 'Nguyen Van B', scope: 'Hoan thien' });
    render(<ContractorForm mode="edit" initial={makeContractor()} />);

    fireEvent.change(screen.getByLabelText(/thông tin liên hệ/i), { target: { value: 'Nguyen Van B' } });
    fireEvent.change(screen.getByLabelText(/phạm vi công việc/i), { target: { value: 'Hoan thien' } });
    fireEvent.click(screen.getByRole('button', { name: /lưu thay đổi/i }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const [id, payload] = updateMock.mock.calls[0];
    expect(id).toBe('11111111-1111-4111-8111-111111111111');
    expect(payload).toMatchObject({ contactName: 'Nguyen Van B', scope: 'Hoan thien' });
    expect(payload).not.toHaveProperty('status');
    // không có confirm dialog status cũ lẫn ghi chú lifecycle khi không đổi status
    expect(screen.queryByText(/Xác nhận đổi trạng thái sang INACTIVE/)).toBeNull();
    expect(screen.queryByText(/không thực hiện ở form hồ sơ/i)).toBeNull();
  });

  it('edit INACTIVE giữ nguyên status INACTIVE: payload không chứa status', async () => {
    updateMock.mockResolvedValueOnce(makeContractor({ status: 'INACTIVE', eligible: false }));
    render(<ContractorForm mode="edit" initial={makeContractor({ status: 'INACTIVE', eligible: false })} />);

    fireEvent.change(screen.getByLabelText(/thông tin liên hệ/i), { target: { value: 'Nguyen Van B' } });
    fireEvent.click(screen.getByRole('button', { name: /lưu thay đổi/i }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock.mock.calls[0][1]).not.toHaveProperty('status');
  });

  it('edit ACTIVE -> INACTIVE trên select: KHÔNG confirm cũ, PATCH payload KHÔNG có status, hiện ghi chú lifecycle (#27)', async () => {
    updateMock.mockResolvedValueOnce(makeContractor());
    render(<ContractorForm mode="edit" initial={makeContractor()} />);

    fireEvent.change(screen.getByLabelText(/trạng thái/i), { target: { value: 'INACTIVE' } });
    // không còn dialog confirm cũ — thay bằng ghi chú hướng dẫn dùng lifecycle ở chi tiết
    expect(screen.queryByText(/Xác nhận đổi trạng thái sang INACTIVE/)).toBeNull();
    expect(screen.getByText(/không thực hiện ở form hồ sơ/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/phạm vi công việc/i), { target: { value: 'Hoan thien' } });
    fireEvent.click(screen.getByRole('button', { name: /lưu thay đổi/i }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const [id, payload] = updateMock.mock.calls[0];
    expect(id).toBe('11111111-1111-4111-8111-111111111111');
    expect(payload).toMatchObject({ contactName: 'Nguyen Van A', scope: 'Hoan thien' });
    expect(payload).not.toHaveProperty('status');
  });

  it('edit INACTIVE -> ACTIVE (chọn lại trên select): payload không có status, chỉ ghi chú (#27)', async () => {
    updateMock.mockResolvedValueOnce(makeContractor());
    render(<ContractorForm mode="edit" initial={makeContractor({ status: 'INACTIVE', eligible: false })} />);

    fireEvent.change(screen.getByLabelText(/trạng thái/i), { target: { value: 'ACTIVE' } });
    expect(screen.queryByText(/Xác nhận đổi trạng thái sang INACTIVE/)).toBeNull();
    expect(screen.getByText(/không thực hiện ở form hồ sơ/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /lưu thay đổi/i }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    expect(updateMock.mock.calls[0][1]).not.toHaveProperty('status');
  });

  it('create mode vẫn gửi status (mặc định ACTIVE)', async () => {
    createMock.mockResolvedValueOnce(makeContractor());
    render(<ContractorForm mode="create" initial={null} />);

    fireEvent.change(screen.getByLabelText(/mã nhà thầu/i), { target: { value: 'CTR-002' } });
    fireEvent.change(screen.getByLabelText(/tên nhà thầu/i), { target: { value: 'Beta' } });
    fireEvent.change(screen.getByLabelText(/thông tin liên hệ/i), { target: { value: 'Nguyen B' } });
    fireEvent.change(screen.getByLabelText(/phạm vi công việc/i), { target: { value: 'Thi cong' } });
    fireEvent.click(screen.getByRole('button', { name: /tạo nhà thầu/i }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock.mock.calls[0][0]).toMatchObject({ code: 'CTR-002', status: 'ACTIVE' });
  });
});
