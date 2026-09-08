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

  it('panel scroll chuẩn: body có overflow class, header không scroll', () => {
    // Portal render ra document.body nên query từ đó, không phải container.
    render(
      <Dialog title="Tiêu đề">
        <p>Nội dung dài</p>
      </Dialog>,
    );
    const panel = document.body.querySelector('.bf-dialog');
    expect(panel).not.toBeNull();
    // Panel flex column + max-h chuẩn (min(85vh, 900px)) qua inline style
    // (Ark Content loại class chứa dấu phẩy) + fallback `.bf-dialog` CSS.
    expect(panel?.className).toMatch('flex-col');
    expect((panel as HTMLElement)?.style?.maxHeight).toBe('min(85vh, 900px)');
    const header = document.body.querySelector('.bf-dialog__header');
    expect(header).not.toBeNull();
    expect(header?.className).toMatch('flex-shrink-0');
    const body = document.body.querySelector('.bf-dialog__body');
    expect(body).not.toBeNull();
    // Body scroll bên trong: flex-1 min-h-0 overflow-y-auto.
    expect(body?.className).toMatch('flex-1');
    expect(body?.className).toMatch('min-h-0');
    expect(body?.className).toMatch('overflow-y-auto');
  });

  it('size prop đổi width, default giữ max-w-lg hiện tại', () => {
    const { rerender } = render(
      <Dialog title="Tiêu đề">
        <p>Nội dung</p>
      </Dialog>,
    );
    const panel = () => document.body.querySelector('.bf-dialog');
    expect(panel()?.className).toMatch('max-w-lg');
    rerender(
      <Dialog title="Tiêu đề" size="sm">
        <p>Nội dung</p>
      </Dialog>,
    );
    expect(panel()?.className).toMatch('max-w-md');
    rerender(
      <Dialog title="Tiêu đề" size="lg">
        <p>Nội dung</p>
      </Dialog>,
    );
    expect(panel()?.className).toMatch('max-w-3xl');
  });
});
