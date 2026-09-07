import { render, screen, fireEvent } from '@testing-library/react';
import {
  ProjectStatusDialog,
  allowedProjectActionsFor,
  isProjectReasonRequired,
  PROJECT_REASON_REQUIRED_MESSAGE,
  PROJECT_REASON_MAX_LENGTH,
} from './ProjectStatusDialog';

function dialog(action: 'ACTIVATE' | 'PAUSE' | 'RESUME' | 'COMPLETE' | 'CLOSE' | 'REOPEN', overrides = {}) {
  const onConfirm = jest.fn();
  const onCancel = jest.fn();
  render(
    <ProjectStatusDialog
      projectName="Du an 1"
      currentStatus="ACTIVE"
      action={action}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onConfirm, onCancel };
}

describe('ProjectStatusDialog PRJ-SRS-002 (issue #33)', () => {
  it('allowed transitions đúng map L1 cho từng trạng thái', () => {
    expect(allowedProjectActionsFor('DRAFT')).toEqual(['ACTIVATE', 'CLOSE']);
    expect(allowedProjectActionsFor('ACTIVE')).toEqual(['PAUSE', 'COMPLETE']);
    expect(allowedProjectActionsFor('PAUSED')).toEqual(['RESUME']);
    expect(allowedProjectActionsFor('COMPLETED')).toEqual(['CLOSE']);
    expect(allowedProjectActionsFor('CLOSED')).toEqual(['REOPEN']);
    expect(allowedProjectActionsFor('UNKNOWN')).toEqual([]);
  });

  it('reason bắt buộc cho PAUSE/CLOSE/REOPEN, optional cho ACTIVATE/RESUME/COMPLETE', () => {
    expect(isProjectReasonRequired('PAUSE')).toBe(true);
    expect(isProjectReasonRequired('CLOSE')).toBe(true);
    expect(isProjectReasonRequired('REOPEN')).toBe(true);
    expect(isProjectReasonRequired('ACTIVATE')).toBe(false);
    expect(isProjectReasonRequired('RESUME')).toBe(false);
    expect(isProjectReasonRequired('COMPLETE')).toBe(false);
  });

  it('PAUSE thiếu reason → chặn submit + hiện lỗi theo field', () => {
    const { onConfirm } = dialog('PAUSE');
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tạm dừng' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe(PROJECT_REASON_REQUIRED_MESSAGE);
  });

  it('CLOSE và REOPEN thiếu reason → chặn submit', () => {
    const c1 = dialog('CLOSE');
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đóng' }));
    expect(c1.onConfirm).not.toHaveBeenCalled();
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  });

  it('ACTIVATE không cần reason → confirm ngay với chuỗi rỗng', () => {
    const { onConfirm } = dialog('ACTIVATE');
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận kích hoạt' }));
    expect(onConfirm).toHaveBeenCalledWith('');
  });

  it('reason hợp lệ → confirm với chuỗi đã trim + counter ≤500', () => {
    const { onConfirm } = dialog('PAUSE');
    const area = screen.getByLabelText(/Lý do/);
    expect(area.getAttribute('maxlength')).toBe(String(PROJECT_REASON_MAX_LENGTH));
    fireEvent.change(area, { target: { value: '  Tam dung de bao tri  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tạm dừng' }));
    expect(onConfirm).toHaveBeenCalledWith('Tam dung de bao tri');
  });

  it('hiển thị serverFieldError dưới textarea + serverMessage banner', () => {
    dialog('RESUME', {
      serverFieldError: 'Lý do tối đa 500 ký tự',
      serverMessage: 'Không thể chuyển trạng thái từ PAUSED với thao tác này',
    });
    expect(screen.getByText('Lý do tối đa 500 ký tự')).not.toBeNull();
    expect(screen.getByText(/Không thể chuyển trạng thái/)).not.toBeNull();
  });

  it('Hủy gọi onCancel', () => {
    const { onCancel } = dialog('COMPLETE');
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
