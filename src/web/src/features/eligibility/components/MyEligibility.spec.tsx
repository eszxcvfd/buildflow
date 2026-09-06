import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MyEligibility } from './MyEligibility';
import { checkMyEligibility } from '@/lib/api/eligibility';

jest.mock('@/lib/api/eligibility', () => ({
  checkWorkerEligibility: jest.fn(),
  checkCrewEligibility: jest.fn(),
  checkMyEligibility: jest.fn(),
}));

const checkMyMock = checkMyEligibility as jest.Mock;

function myResult(overrides = {}) {
  return {
    resourceType: 'WORKER',
    resourceId: 'worker-me',
    eligible: true,
    checkedAt: '2026-02-01T08:00:00.000Z',
    correlationId: 'corr-me-1',
    conditions: [
      { code: 'RESOURCE_ACTIVE', passed: true, reasonCode: 'OK', detail: 'Hồ sơ worker đang hiệu lực' },
      { code: 'TRADE_SKILL_MATCH', passed: null, reasonCode: 'NOT_REQUESTED', detail: 'Không yêu cầu kiểm tra ngành nghề' },
      { code: 'TRADE_CAPABILITY_DATA', passed: true, reasonCode: 'OK', detail: 'Worker có 1 ngành nghề hiệu lực' },
      { code: 'WORKLOAD', passed: true, reasonCode: 'OK', detail: 'Đang có 0 công việc mở' },
      { code: 'SCHEDULE_CONFLICT', passed: null, reasonCode: 'NOT_EVALUABLE', detail: 'Chưa có dữ liệu work-order' },
    ],
    crews: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MyEligibility ORG-SRS-008', () => {
  it('success hiển thị checklist + mã đối chiếu', async () => {
    checkMyMock.mockResolvedValue(myResult());
    render(<MyEligibility />);
    await waitFor(() => expect(screen.getByText(/Đủ điều kiện nhận việc/)).not.toBeNull());
    expect(screen.getByText(/Mã đối chiếu: corr-me-1/)).not.toBeNull();
    expect(screen.getByText('Điều kiện nhận việc của tôi')).not.toBeNull();
  });

  it('hiển thị crews membership + empty khi chưa thuộc đội nào', async () => {
    checkMyMock.mockResolvedValue(myResult({
      crews: [{
        crewId: 'crew-1', crewCode: 'E2E8-CREW', crewName: 'E2E8 Doi Kiem Dinh',
        memberRole: 'MEMBER', effectiveFrom: '2026-09-06', effectiveTo: null,
      }],
    }));
    const { unmount } = render(<MyEligibility />);
    await waitFor(() => expect(screen.getByText('Đội thi công')).not.toBeNull());
    expect(screen.getByText('E2E8-CREW · E2E8 Doi Kiem Dinh')).not.toBeNull();
    expect(screen.getByText(/Vai trò: MEMBER/)).not.toBeNull();
    unmount();
    checkMyMock.mockResolvedValue(myResult({ crews: [] }));
    render(<MyEligibility />);
    await waitFor(() => expect(screen.getByText('Chưa thuộc đội nào')).not.toBeNull());
  });

  it('404 → empty state tài khoản không có hồ sơ worker', async () => {
    checkMyMock.mockRejectedValue({ status: 404, message: 'user không có hồ sơ worker', code: 'RESOURCE_NOT_FOUND' });
    render(<MyEligibility />);
    await waitFor(() => expect(screen.getByText('Tài khoản không có hồ sơ worker')).not.toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('lỗi máy chủ rơi vào lỗi chung + retry', async () => {
    // GET /api/v1/eligibility/me chỉ có JwtAuthGuard, không check role → không có nhánh 403 riêng;
    // mọi lỗi ngoài 401/404 đi vào nhánh lỗi chung, không nhánh riêng.
    checkMyMock.mockRejectedValue({ status: 502, message: 'Bad Gateway' });
    render(<MyEligibility />);
    await waitFor(() => expect(screen.getByText('Bad Gateway')).not.toBeNull());
    checkMyMock.mockResolvedValue(myResult());
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(screen.getByText(/Đủ điều kiện nhận việc/)).not.toBeNull());
  });

  it('lỗi chung có retry và tải lại thành công', async () => {
    checkMyMock.mockRejectedValueOnce({ status: 500, message: 'Lỗi máy chủ' });
    checkMyMock.mockResolvedValueOnce(myResult());
    render(<MyEligibility />);
    await waitFor(() => expect(screen.getByText('Lỗi máy chủ')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(screen.getByText(/Đủ điều kiện nhận việc/)).not.toBeNull());
  });
});
