import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkerDetail } from './WorkerDetail';
import { getWorker } from '@/lib/api/workers';
import { checkWorkerEligibility } from '@/lib/api/eligibility';
import { listTrades } from '@/lib/api/trades';
import { listAuditLogs } from '@/lib/api/audit-logs';

jest.mock('@/lib/api/workers', () => ({
  getWorker: jest.fn(),
  updateWorker: jest.fn(),
  changeWorkerLifecycleStatus: jest.fn(),
  getWorkerOpenWork: jest.fn(),
}));
jest.mock('@/lib/api/eligibility', () => ({
  checkWorkerEligibility: jest.fn(),
  checkCrewEligibility: jest.fn(),
  checkMyEligibility: jest.fn(),
}));
jest.mock('@/lib/api/trades', () => ({ listTrades: jest.fn() }));
jest.mock('@/lib/api/audit-logs', () => ({ listAuditLogs: jest.fn() }));

const getWorkerMock = getWorker as jest.Mock;
const checkEligibilityMock = checkWorkerEligibility as jest.Mock;
const listTradesMock = listTrades as jest.Mock;
const listAuditLogsMock = listAuditLogs as jest.Mock;

function worker(overrides = {}) {
  return {
    id: 'worker-1',
    email: 'worker@example.com',
    fullName: 'Nguyen Van A',
    phone: '0900000000',
    avatarUrl: null,
    employeeCode: 'NV-001',
    userType: 'WORKER',
    contractorId: null,
    status: 'ACTIVE',
    trades: [],
    eligible: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function eligibility(overrides = {}) {
  return {
    resourceType: 'WORKER',
    resourceId: 'worker-1',
    eligible: false,
    checkedAt: '2026-02-01T08:00:00.000Z',
    correlationId: 'corr-w-1',
    conditions: [
      { code: 'RESOURCE_ACTIVE', passed: true, reasonCode: 'OK', detail: 'Hồ sơ worker đang hiệu lực' },
      { code: 'TRADE_SKILL_MATCH', passed: null, reasonCode: 'NOT_REQUESTED', detail: 'Không yêu cầu kiểm tra ngành nghề' },
      { code: 'TRADE_CAPABILITY_DATA', passed: false, reasonCode: 'CAPABILITY_DATA_MISSING', detail: 'Worker chưa có dữ liệu năng lực' },
      { code: 'WORKLOAD', passed: true, reasonCode: 'OK', detail: 'Đang có 0 công việc mở' },
      { code: 'SCHEDULE_CONFLICT', passed: null, reasonCode: 'NOT_EVALUABLE', detail: 'Chưa có dữ liệu work-order' },
    ],
    crews: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getWorkerMock.mockResolvedValue(worker());
  checkEligibilityMock.mockResolvedValue(eligibility());
  listTradesMock.mockResolvedValue({ data: [], total: 0, limit: 100, offset: 0 });
  listAuditLogsMock.mockResolvedValue({ data: [], total: 0, limit: 10, offset: 0 });
});

describe('WorkerDetail ORG-SRS-008', () => {
  it('hiển thị checklist điều kiện nhận việc thay cho boolean cũ', async () => {
    render(<WorkerDetail id="worker-1" />);
    await waitFor(() => expect(screen.getByText('Nguyen Van A')).not.toBeNull());
    expect(checkEligibilityMock).toHaveBeenCalledWith('worker-1');
    await waitFor(() => expect(screen.getByText('Điều kiện nhận việc')).not.toBeNull());
    expect(screen.getByText('Không đủ điều kiện')).not.toBeNull();
    expect(screen.getByText(/Mã đối chiếu:/)).not.toBeNull();
    expect(screen.getByText('corr-w-1')).not.toBeNull();
    expect(screen.getByText('Thiếu dữ liệu năng lực')).not.toBeNull();
    // boolean-only cũ đã gỡ: không còn dòng tóm tắt theo worker.eligible
    expect(screen.queryByText('Không đủ điều kiện — chặn phân công mới, lịch sử vẫn giữ')).toBeNull();
  });

  it('retry khi eligibility lỗi rồi tải lại thành công', async () => {
    checkEligibilityMock.mockRejectedValueOnce({ status: 500, message: 'Lỗi máy chủ' });
    checkEligibilityMock.mockResolvedValueOnce(eligibility());
    render(<WorkerDetail id="worker-1" />);
    await waitFor(() => expect(screen.getByText('Lỗi máy chủ')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(screen.getByText('Không đủ điều kiện')).not.toBeNull());
  });
});
