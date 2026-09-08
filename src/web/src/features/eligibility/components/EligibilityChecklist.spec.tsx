import { render, screen, fireEvent } from '@testing-library/react';
import { EligibilityChecklist, badgeFor } from './EligibilityChecklist';
import type { EligibilityCondition, EligibilityResult } from '@/lib/api/eligibility';

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
    expect(screen.getAllByText('Đạt').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Kỹ năng không đủ')).not.toBeNull();
    expect(screen.getByText('Không đánh giá được')).not.toBeNull();
    expect(screen.getByText('Không đủ điều kiện')).not.toBeNull();
    expect(screen.getByText(/chặn phân công mới, lịch sử vẫn giữ/)).not.toBeNull();
    expect(screen.getByText('3/5 điều kiện đạt · 1 không áp dụng')).not.toBeNull();
    expect(screen.getByText(/Mã đối chiếu: corr-123/)).not.toBeNull();
    // chi tiết từng condition
    expect(screen.getByText('Cấp kỹ năng thấp hơn yêu cầu')).not.toBeNull();
  });

  it('verdict success khi eligible', () => {
    render(<EligibilityChecklist result={workerResult({ eligible: true })} loading={false} error={null} onRefresh={() => {}} />);
    expect(screen.getByText('Đủ điều kiện')).not.toBeNull();
    expect(screen.getByText(/cho phép phân công mới/)).not.toBeNull();
  });

  it('badgeFor map đủ reasonCode theo contract eligibility.policy.ts', () => {
    expect(badgeFor(true, 'OK')).toEqual({ label: 'Đạt', tone: 'ok' });
    expect(badgeFor(false, 'RESOURCE_LOCKED')).toEqual({ label: 'Bị khóa', tone: 'risk' });
    expect(badgeFor(false, 'RESOURCE_INACTIVE')).toEqual({ label: 'Ngừng hoạt động', tone: 'busy' });
    expect(badgeFor(false, 'TRADE_NOT_FOUND')).toEqual({ label: 'Ngành nghề không tồn tại', tone: 'risk' });
    expect(badgeFor(false, 'TRADE_INACTIVE')).toEqual({ label: 'Ngành nghề ngừng hoạt động', tone: 'busy' });
    expect(badgeFor(false, 'SKILL_LEVEL_TOO_LOW')).toEqual({ label: 'Kỹ năng không đủ', tone: 'risk' });
    expect(badgeFor(false, 'CAPABILITY_DATA_MISSING')).toEqual({ label: 'Thiếu dữ liệu năng lực', tone: 'busy' });
    expect(badgeFor(false, 'NO_ACTIVE_MEMBERS')).toEqual({ label: 'Không có thành viên hoạt động', tone: 'risk' });
    expect(badgeFor(null, 'NOT_REQUESTED')).toEqual({ label: 'Không áp dụng', tone: 'idle' });
    expect(badgeFor(null, 'NOT_EVALUABLE')).toEqual({ label: 'Không đánh giá được', tone: 'idle' });
  });

  it('badgeFor fallback reasonCode lạ theo passed', () => {
    expect(badgeFor(false, 'SOME_FUTURE_CODE')).toEqual({ label: 'Không đạt', tone: 'risk' });
    expect(badgeFor(null, 'SOME_FUTURE_CODE')).toEqual({ label: 'Không đánh giá được', tone: 'idle' });
    expect(badgeFor(true, 'SOME_FUTURE_CODE')).toEqual({ label: 'Đạt', tone: 'ok' });
  });

  it('render từng nhóm badge fail + summary đếm đúng', () => {
    const conditions: EligibilityCondition[] = [
      { code: 'RESOURCE_ACTIVE', passed: false, reasonCode: 'RESOURCE_INACTIVE', detail: 'Hồ sơ ngừng hoạt động' },
      { code: 'TRADE_SKILL_MATCH', passed: false, reasonCode: 'SKILL_LEVEL_TOO_LOW', detail: 'Kỹ năng thấp' },
      { code: 'TRADE_CAPABILITY_DATA', passed: false, reasonCode: 'CAPABILITY_DATA_MISSING', detail: 'Thiếu dữ liệu' },
      { code: 'MEMBER_COVERAGE', passed: null, reasonCode: 'NOT_REQUESTED', detail: 'Không yêu cầu' },
      { code: 'SCHEDULE_CONFLICT', passed: null, reasonCode: 'NOT_EVALUABLE', detail: 'Chưa có dữ liệu' },
      { code: 'WORKLOAD', passed: true, reasonCode: 'OK', detail: 'Ổn' },
    ];
    const r = workerResult({ eligible: false, conditions });
    render(<EligibilityChecklist result={r} loading={false} error={null} onRefresh={() => {}} />);
    expect(screen.getByText('Ngừng hoạt động')).not.toBeNull();
    expect(screen.getByText('Kỹ năng không đủ')).not.toBeNull();
    expect(screen.getByText('Thiếu dữ liệu năng lực')).not.toBeNull();
    expect(screen.getByText('Không áp dụng')).not.toBeNull();
    expect(screen.getByText('Không đánh giá được')).not.toBeNull();
    expect(screen.getByText('Đạt')).not.toBeNull();
    expect(screen.getByText('1/6 điều kiện đạt · 2 không áp dụng')).not.toBeNull();
  });

  it('render badge crew NO_ACTIVE_MEMBERS', () => {
    const r = workerResult({
      eligible: false,
      conditions: [
        { code: 'MEMBER_COVERAGE', passed: false, reasonCode: 'NO_ACTIVE_MEMBERS', detail: 'Không có thành viên' },
      ],
    });
    render(<EligibilityChecklist result={r} loading={false} error={null} onRefresh={() => {}} />);
    expect(screen.getByText('Không có thành viên hoạt động')).not.toBeNull();
    expect(screen.getByText('0/1 điều kiện đạt · 0 không áp dụng')).not.toBeNull();
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
