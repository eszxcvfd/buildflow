import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkOrderReadinessPanel } from './WorkOrderReadinessPanel';
import type { PublishCheckResult } from '@/lib/api/work-order-readiness';

function readyCheck(): PublishCheckResult {
  return {
    workOrderId: '33333333-3333-4333-8333-333333333333',
    status: 'DRAFT',
    ready: true,
    unmet: [],
    checkedAt: '2026-02-01T00:00:00.000Z',
  };
}

function unmetCheck(): PublishCheckResult {
  return {
    workOrderId: '33333333-3333-4333-8333-333333333333',
    status: 'DRAFT',
    ready: false,
    unmet: [
      { code: 'MISSING_SCHEDULE', field: 'plannedStartAt', message: 'Thiếu thời điểm bắt đầu kế hoạch' },
      { code: 'AREA_INVALID', field: 'areaId', message: 'Khu vực không thuộc dự án hoặc đã ngừng sử dụng' },
    ],
    checkedAt: '2026-02-01T00:00:00.000Z',
  };
}

describe('WorkOrderReadinessPanel JOB-SRS-002', () => {
  it('ready → badge xanh + note chờ lệnh công bố + nút disabled có tooltip', async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();
    render(<WorkOrderReadinessPanel check={readyCheck()} loading={false} error={null} onRetry={onRetry} />);
    expect(screen.getByText('Đủ điều kiện công bố')).not.toBeNull();
    expect(screen.getByText(/chờ lệnh công bố \(JOB-SRS-004\)/)).not.toBeNull();
    const publish = screen.getByRole('button', { name: 'Công bố' });
    expect(publish.hasAttribute('disabled')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Kiểm tra lại' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('unmet → từng mục có code + message + field; nút Publish/Phân công disabled kèm lý do', () => {
    render(<WorkOrderReadinessPanel check={unmetCheck()} loading={false} error={null} onRetry={jest.fn()} />);
    expect(screen.getByText('Chưa đủ điều kiện (2)')).not.toBeNull();
    expect(screen.getByText('MISSING_SCHEDULE')).not.toBeNull();
    expect(screen.getByText('Thiếu thời điểm bắt đầu kế hoạch')).not.toBeNull();
    expect(screen.getByText('AREA_INVALID')).not.toBeNull();
    expect(screen.getByText(/Khu vực không thuộc dự án/)).not.toBeNull();
    const publish = screen.getByRole('button', { name: 'Công bố' });
    const assign = screen.getByRole('button', { name: 'Phân công' });
    expect(publish.hasAttribute('disabled')).toBe(true);
    expect(assign.hasAttribute('disabled')).toBe(true);
    expect(publish.parentElement?.getAttribute('title')).toMatch(/Chưa đủ điều kiện công bố: 2 mục/);
  });

  it('loading → trạng thái chờ; error + retry gọi onRetry', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <WorkOrderReadinessPanel check={null} loading={true} error={null} onRetry={jest.fn()} />,
    );
    expect(screen.getByText('Đang kiểm tra điều kiện công bố…')).not.toBeNull();
    const onRetry = jest.fn();
    rerender(<WorkOrderReadinessPanel check={null} loading={false} error={{ status: 500, message: 'Lỗi máy chủ' }} onRetry={onRetry} />);
    expect(screen.getByText('Lỗi máy chủ')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Kiểm tra lại' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('403 → panel quyền graceful (không lộ chi tiết) + retry', () => {
    render(
      <WorkOrderReadinessPanel
        check={null}
        loading={false}
        error={{ status: 403, message: 'Forbidden' }}
        onRetry={jest.fn()}
      />,
    );
    expect(screen.getByText(/Không có quyền xem điều kiện công bố/)).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Kiểm tra lại' })).not.toBeNull();
  });
});
