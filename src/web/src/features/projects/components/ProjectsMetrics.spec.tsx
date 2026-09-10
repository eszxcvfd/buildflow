import { render, screen } from '@testing-library/react';
import { ProjectsMetrics } from './ProjectsMetrics';

describe('ProjectsMetrics', () => {
  it('đếm chính xác từ props + placeholder trung thực cho ô không-data', () => {
    render(<ProjectsMetrics total={5} active={4} />);
    expect(screen.getByTestId('projects-metric-total').textContent).toMatch(/05/);
    expect(screen.getByTestId('projects-metric-active').textContent).toMatch(/04/);
    expect(screen.getByTestId('projects-metric-budget').textContent).toMatch(/—/);
    expect(screen.getByTestId('projects-metric-budget').textContent).toMatch(/Chưa có dữ liệu ngân sách/);
    expect(screen.getByTestId('projects-metric-delay').textContent).toMatch(/—/);
    expect(screen.getByTestId('projects-metric-delay').textContent).toMatch(/Chưa có dữ liệu tiến độ/);
    // 0 literal fabricated của mock.
    expect(document.body.textContent).not.toMatch(/48\.2|72%|24\.5|80% tải/);
  });
});
