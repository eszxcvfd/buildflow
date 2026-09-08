import { render, screen, within } from '@testing-library/react';
import { KanbanView, ViewToggle, type KanbanColumn } from './KanbanView';

interface Item {
  id: string;
  status: string;
  name: string;
  code: string;
}

const COLUMNS: readonly KanbanColumn[] = [
  { key: 'ACTIVE', label: 'Hoạt động', tone: 'ok' },
  { key: 'INACTIVE', label: 'Ngừng hoạt động', tone: 'risk' },
  { key: 'LOCKED', label: 'Bị khóa', tone: 'busy' },
];

const ITEMS: Item[] = [
  { id: '1', status: 'ACTIVE', name: 'Nguyen Van A', code: 'NV-001' },
  { id: '2', status: 'ACTIVE', name: 'Tran Thi B', code: 'NV-002' },
  { id: '3', status: 'INACTIVE', name: 'Le Van C', code: 'NV-003' },
];

function renderKanban(items: readonly Item[] = ITEMS) {
  return render(
    <KanbanView<Item>
      columns={COLUMNS}
      items={items}
      getColumnKey={(i) => i.status}
      getCardProps={(i) => ({ title: i.name, metas: [i.code], href: `/workers/${i.id}` })}
    />,
  );
}

describe('KanbanView', () => {
  it('render đủ cột với count badge đúng', () => {
    renderKanban();
    for (const col of COLUMNS) {
      expect(screen.getByText(col.label)).not.toBeNull();
    }
    expect(screen.getByLabelText('Hoạt động (2)')).not.toBeNull();
    expect(screen.getByLabelText('Ngừng hoạt động (1)')).not.toBeNull();
    expect(screen.getByLabelText('Bị khóa (0)')).not.toBeNull();
  });

  it('card hiển thị tên + meta và link tới detail', () => {
    renderKanban();
    const link = screen.getByRole('link', { name: /Nguyen Van A/ });
    expect(link.getAttribute('href')).toBe('/workers/1');
    expect(within(link as HTMLElement).getByText('NV-001')).not.toBeNull();
  });

  it('cột rỗng hiển thị dashed placeholder', () => {
    renderKanban();
    const locked = screen.getByLabelText('Bị khóa (0)');
    expect(within(locked as HTMLElement).getByText('Chưa có hồ sơ nào')).not.toBeNull();
  });

  it('empty toàn board khi không có item', () => {
    renderKanban([]);
    expect(screen.getAllByText('Chưa có hồ sơ nào')).toHaveLength(3);
  });
});

describe('ViewToggle', () => {
  it('2 nút Bảng | Kanban, mặc định Bảng active', () => {
    const onChange = jest.fn();
    render(<ViewToggle value="table" onChange={onChange} />);
    const group = screen.getByRole('group', { name: 'Chế độ xem' });
    const buttons = within(group as HTMLElement).getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Bảng/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Kanban/ }).getAttribute('aria-pressed')).toBe('false');
  });
});
