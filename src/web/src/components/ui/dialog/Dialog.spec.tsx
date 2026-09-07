import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Dialog } from './Dialog';

describe('Dialog wrapper (Ark UI)', () => {
  it('renders title + children with dialog role', () => {
    render(
      <Dialog title="Xác nhận xóa?">
        <p>Nội dung dialog</p>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).not.toBeNull();
    expect(screen.getByText('Xác nhận xóa?')).not.toBeNull();
    expect(screen.getByText('Nội dung dialog')).not.toBeNull();
  });

  it('Escape / close button calls onClose', async () => {
    const onClose = jest.fn();
    render(
      <Dialog title="Tiêu đề" onClose={onClose}>
        <p>Nội dung</p>
      </Dialog>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('controlled open=false keeps content mounted but closed', () => {
    render(
      <Dialog title="Tiêu đề" open={false}>
        <p>Nội dung ẩn</p>
      </Dialog>,
    );
    // Ark keeps content in the DOM (presence); closed state is data-state.
    expect(screen.getByRole('dialog', { hidden: true }).getAttribute('data-state')).toBe('closed');
  });
});
