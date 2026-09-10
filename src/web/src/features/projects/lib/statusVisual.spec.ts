import { formatUpdatedAt, statusVisual } from '@/features/projects/lib/statusVisual';

/** F013/F014 pin — statusVisual bao phủ mọi status thật + unknown. */
describe('statusVisual (mọi status)', () => {
  it.each([
    ['ACTIVE', 'Đang chạy', 'bg-emerald-500', 'text-emerald-700'],
    ['DRAFT', 'Bản nháp', 'bg-zinc-400', 'text-zinc-500'],
    ['PAUSED', 'Tạm dừng', 'bg-amber-500', 'text-amber-700'],
    ['COMPLETED', 'Hoàn thành', 'bg-blue-600', 'text-blue-700'],
    ['CLOSED', 'Đóng', 'bg-zinc-400', 'text-zinc-500'],
  ])('%s → %s', (status, label, dotClass, textClass) => {
    const v = statusVisual(status);
    expect(v.label).toBe(label);
    expect(v.dotClass).toBe(dotClass);
    expect(v.textClass).toBe(textClass);
  });

  it('status lạ → echo + tone zinc (không crash)', () => {
    const v = statusVisual('WHATEVER');
    expect(v.label).toBe('WHATEVER');
    expect(v.dotClass).toBe('bg-zinc-400');
  });
});

describe('formatUpdatedAt', () => {
  const now = new Date('2026-09-10T12:00:00.000Z');
  it('vừa xong / phút / giờ / ngày / date', () => {
    expect(formatUpdatedAt('2026-09-10T11:59:40.000Z', now)).toBe('vừa xong');
    expect(formatUpdatedAt('2026-09-10T11:30:00.000Z', now)).toBe('30 phút trước');
    expect(formatUpdatedAt('2026-09-10T09:00:00.000Z', now)).toBe('3 giờ trước');
    expect(formatUpdatedAt('2026-09-05T12:00:00.000Z', now)).toBe('5 ngày trước');
    expect(formatUpdatedAt('2026-01-01T00:00:00.000Z', now)).toBe(
      new Date('2026-01-01T00:00:00.000Z').toLocaleDateString('vi-VN'),
    );
  });

  it('ISO hỏng → —', () => {
    expect(formatUpdatedAt('not-a-date', now)).toBe('—');
  });
});
