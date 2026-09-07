import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './Select';

const OPTIONS = [
  { value: 'ACTIVE', label: 'Đang hoạt động' },
  { value: 'INACTIVE', label: 'Ngừng hoạt động' },
];

/** Ark trigger carries role=combobox named by the field label. */
function trigger(name = 'Trạng thái') {
  return screen.getByRole('combobox', { name });
}

function renderSelect(value = '', onChange = jest.fn()) {
  render(
    <Select
      id="status-select"
      label="Trạng thái"
      value={value}
      options={OPTIONS}
      onChange={onChange}
      placeholder="— Chọn trạng thái —"
    />,
  );
  return onChange;
}

describe('Select wrapper (Ark UI)', () => {
  it('exposes the trigger as a labelled combobox', () => {
    renderSelect();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('shows placeholder when empty, selected label when valued', () => {
    const { rerender } = render(
      <Select id="s" label="Trạng thái" value="" options={OPTIONS} onChange={jest.fn()} placeholder="— Chọn trạng thái —" />,
    );
    expect(trigger().textContent).toContain('— Chọn trạng thái —');
    rerender(
      <Select id="s" label="Trạng thái" value="ACTIVE" options={OPTIONS} onChange={jest.fn()} placeholder="— Chọn trạng thái —" />,
    );
    expect(trigger().textContent).toContain('Đang hoạt động');
  });

  it('chooses an option → onChange with the option value', async () => {
    const user = userEvent.setup();
    const onChange = renderSelect();
    await user.click(trigger());
    await user.click(await screen.findByRole('option', { name: 'Ngừng hoạt động' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('INACTIVE'));
  });

  it('keyboard: opens on ArrowDown showing a listbox', async () => {
    const user = userEvent.setup();
    renderSelect();
    trigger().focus();
    await user.keyboard('{ArrowDown}');
    expect(await screen.findByRole('listbox')).not.toBeNull();
  });
});
