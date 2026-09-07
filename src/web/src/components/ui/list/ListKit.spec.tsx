import { render, screen, fireEvent } from '@testing-library/react';
import { ActiveChips, ListPagination, ListToolbar, SearchField } from './ListKit';

describe('ListKit (list-screen kit)', () => {
  it('SearchField giữ label association + placeholder', () => {
    const onChange = jest.fn();
    render(
      <SearchField
        id="kit-search"
        label="Tìm kiếm"
        placeholder="Tên, email…"
        value=""
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText('Tìm kiếm');
    expect(input.getAttribute('placeholder')).toBe('Tên, email…');
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  it('ListToolbar đặt count bên phải toolbar', () => {
    render(
      <ListToolbar count="Tổng 5 bản ghi">
        <button type="button">Tìm</button>
      </ListToolbar>,
    );
    expect(screen.getByText('Tổng 5 bản ghi')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Tìm' })).not.toBeNull();
  });

  it('ActiveChips rỗng render null; có chips thì nút × xóa từng cái', () => {
    const onRemove = jest.fn();
    const { rerender } = render(<ActiveChips chips={[]} />);
    expect(screen.queryByLabelText(/Xóa bộ lọc/)).toBeNull();
    rerender(
      <ActiveChips chips={[{ key: 's', label: 'Trạng thái: ACTIVE', onRemove }]} />,
    );
    expect(screen.getByText('Trạng thái: ACTIVE')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc Trạng thái: ACTIVE' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('ListPagination ẩn khi 1 trang; đủ Prev/Next + Trang X/Y', () => {
    const onPage = jest.fn();
    const { rerender } = render(<ListPagination page={1} totalPages={1} onPage={onPage} />);
    expect(screen.queryByLabelText('Phân trang')).toBeNull();
    rerender(
      <ListPagination
        page={1}
        totalPages={3}
        onPage={onPage}
        prevLabel="Trang trước"
        nextLabel="Trang sau"
      />,
    );
    expect(screen.getByLabelText('Phân trang')).not.toBeNull();
    expect(screen.getByText('Trang 1/3')).not.toBeNull();
    expect(screen.getByRole('button', { name: /Trang trước/ }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Trang sau/ }));
    expect(onPage).toHaveBeenCalledWith(2);
  });
});
