import { render, screen, fireEvent } from '@testing-library/react';
import { ResourceStatusDialog } from './ResourceStatusDialog';

describe('ResourceStatusDialog CREW ORG-SRS-006', () => {
  it('entityType CREW đổi text sang đội thi công + công việc mở của đội', () => {
    render(
      <ResourceStatusDialog
        resourceName="Doi ket cau"
        currentStatus="ACTIVE"
        action="SUSPEND"
        entityType="CREW"
        openCheck={{ state: 'done', openAssignments: 2 }}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText(/Xác nhận tạm ngừng đội thi công — Doi ket cau\?/)).not.toBeNull();
    expect(screen.getByText(/2.*công việc\/lịch mở của đội/)).not.toBeNull();
  });

  it('mặc định (không entityType) giữ text nguồn lực cũ', () => {
    render(
      <ResourceStatusDialog
        resourceName="Nguyen Van A"
        currentStatus="ACTIVE"
        action="SUSPEND"
        openCheck={{ state: 'done', openAssignments: 1 }}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText(/Xác nhận tạm ngừng nguồn lực — Nguyen Van A\?/)).not.toBeNull();
    expect(screen.getByText(/Nguồn lực đang có/)).not.toBeNull();
  });

  it('lý do bắt buộc khi SUSPEND: chặn submit trống', () => {
    const onConfirm = jest.fn();
    render(
      <ResourceStatusDialog
        resourceName="Doi ket cau"
        currentStatus="ACTIVE"
        action="TERMINATE"
        entityType="CREW"
        openCheck={{ state: 'done', openAssignments: 0 }}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận chấm dứt/ }));
    expect(screen.getByText('Lý do là bắt buộc khi tạm ngừng/chấm dứt')).not.toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
