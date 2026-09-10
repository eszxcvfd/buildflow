import { projectsToCsv } from './exportCsv';

const ROW = {
  id: 'p-1',
  code: 'PRA',
  name: 'Du an "A", ven song',
  status: 'ACTIVE',
  managerId: 'm-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

describe('projectsToCsv', () => {
  it('header + escape dấu phẩy/ngoặc kép + chỉ rows đã lọc', () => {
    const csv = projectsToCsv([ROW]);
    const lines = csv.replace(/^\uFEFF/, '').split('\n');
    expect(lines[0]).toBe('Mã,Tên,Trạng thái,Mã quản lý,Ngày tạo,Ngày cập nhật');
    expect(lines[1]).toBe('PRA,"Du an ""A"", ven song",ACTIVE,m-1,2026-01-01T00:00:00.000Z,2026-06-01T00:00:00.000Z');
  });

  it('rỗng → chỉ header', () => {
    expect(projectsToCsv([]).replace(/^\uFEFF/, '')).toBe('Mã,Tên,Trạng thái,Mã quản lý,Ngày tạo,Ngày cập nhật\n');
  });
});
