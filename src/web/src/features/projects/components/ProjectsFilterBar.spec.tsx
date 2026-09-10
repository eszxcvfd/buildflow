import { fireEvent, render, screen } from '@testing-library/react';
import { ProjectsFilterBar } from './ProjectsFilterBar';

describe('ProjectsFilterBar', () => {
  it('tabs đếm đúng + click đổi filter status', () => {
    const onStatusChange = jest.fn();
    render(
      <ProjectsFilterBar
        status="ALL"
        onStatusChange={onStatusChange}
        search=""
        onSearchChange={jest.fn()}
        counts={{ all: 5, active: 4, draft: 1 }}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Tất cả (5)' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Thi công (4)' }).getAttribute('aria-selected')).toBe('false');
    fireEvent.click(screen.getByRole('tab', { name: 'Bản nháp (1)' }));
    expect(onStatusChange).toHaveBeenCalledWith('DRAFT');
  });

  it('giữ id driver + không tab nào active khi status ngoài tab set', () => {
    render(
      <ProjectsFilterBar
        status="PAUSED"
        onStatusChange={jest.fn()}
        search=""
        onSearchChange={jest.fn()}
        counts={{ all: 5, active: 4, draft: 1 }}
      />,
    );
    expect(document.getElementById('projects-search')).not.toBeNull();
    expect(screen.getByRole('combobox', { name: 'Trạng thái' })).not.toBeNull();
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.getAttribute('aria-selected')).toBe('false');
    }
  });

  it('search đổi text', () => {
    const onSearchChange = jest.fn();
    render(
      <ProjectsFilterBar
        status="ALL"
        onStatusChange={jest.fn()}
        search=""
        onSearchChange={onSearchChange}
        counts={{ all: 5, active: 4, draft: 1 }}
      />,
    );
    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'PRB' } });
    expect(onSearchChange).toHaveBeenCalledWith('PRB');
  });
});
