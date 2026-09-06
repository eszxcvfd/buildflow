import { render, screen, fireEvent } from '@testing-library/react';
import { EligibilityChecklist } from './EligibilityChecklist';
import type { EligibilityResult } from '@/lib/api/eligibility';

function workerResult(overrides = {}): EligibilityResult {
  return {
    resourceType: 'WORKER',
    resourceId: 'worker-1',
    eligible: false,
    checkedAt: '2026-02-01T08:00:00.000Z',
    correlationId: 'corr-123',
    conditions: [
      { code: 'RESOURCE_ACTIVE', passed: true, reasonCode: 'OK', detail: 'Hồ sơ worker đang hiệu lực' },
      { code: 'TRADE_SKILL_MATCH', passed: false, reasonCode: 'SKILL_LEVEL_TOO_LOW', detail: 'Cấp kỹ năng thấp hơn yêu cầu' },
      { code: 'TRADE_CAPABILITY_DATA', passed: true, reasonCode: 'OK', detail: 'Worker có 2 ngành nghề hiệu lực' },
      { code: 'WORKLOAD', passed: true, reasonCode: 'OK', detail: 'Đang có 1 công việc mở' },
      { code: 'SCHEDULE_CONFLICT', passed: null, reasonCode: 'NOT_EVALUABLE', detail: 'Chưa có dữ liệu work-order' },
    ],
    crews: [],
    ...overrides,
  };
}

describe('EligibilityChecklist ORG-SRS-008', () => {
  it('render đủ 3 trạng thái condition + verdict lỗi + mã đối chiếu', () => {
    render(<EligibilityChecklist result={workerResult()} loading={false} error={null} onRefresh={() => {}} />);
    expect(screen.getAllByText('ĐẠT').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('KHÔNG ĐẠT')).not.toBeNull();
    expect(screen.getByText('KHÔNG ĐÁNH GIÁ ĐƯỢC')).not.toBeNull();
    expect(screen.getByText(/Không đủ điều kiện nhận việc/)).not.toBeNull();
    expect(screen.getByText(/Mã đối chiếu: corr-123/)).not.toBeNull();
    // chi tiết từng condition
    expect(screen.getByText('Cấp kỹ năng thấp hơn yêu cầu')).not.toBeNull();
  });

  it('verdict success khi eligible', () => {
    render(<EligibilityChecklist result={workerResult({ eligible: true })} loading={false} error={null} onRefresh={() => {}} />);
    expect(screen.getByText(/Đủ điều kiện nhận việc/)).not.toBeNull();
  });

  it('nút kiểm tra lại gọi onRefresh', () => {
    const onRefresh = jest.fn();
    render(<EligibilityChecklist result={workerResult()} loading={false} error={null} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('loading skeleton khi chưa có kết quả', () => {
    render(<EligibilityChecklist result={null} loading={true} error={null} onRefresh={() => {}} />);
    expect(screen.getByText('Đang kiểm tra điều kiện nhận việc…')).not.toBeNull();
  });

  it('lỗi + retry với role=alert', () => {
    const onRefresh = jest.fn();
    render(
      <EligibilityChecklist result={null} loading={false} error={{ status: 500, message: 'Lỗi máy chủ' }} onRefresh={onRefresh} />,
    );
    expect(screen.getByRole('alert')).not.toBeNull();
    expect(screen.getByText('Lỗi máy chủ')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('401 hiển thị link đăng nhập', () => {
    render(
      <EligibilityChecklist result={null} loading={false} error={{ status: 401, message: 'Unauthorized' }} onRefresh={() => {}} />,
    );
    expect(screen.getByText(/Phiên hết hạn/)).not.toBeNull();
    expect(screen.getByText('Đến trang đăng nhập')).not.toBeNull();
  });

  it('403 hiển thị yêu cầu quyền + retry', () => {
    render(
      <EligibilityChecklist result={null} loading={false} error={{ status: 403, message: 'Forbidden' }} onRefresh={() => {}} />,
    );
    expect(screen.getByText(/Không có quyền xem điều kiện nhận việc/)).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Thử lại' })).not.toBeNull();
  });
});
