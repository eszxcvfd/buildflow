import { TradeEntity } from './trade.entity';

function makeTrade(overrides: Partial<Record<string, unknown>> = {}): TradeEntity {
  return new TradeEntity({
    id: '11111111-1111-4111-8111-111111111111',
    code: 'TRD-001',
    name: 'Xay dung phan tho',
    description: 'Cac cong viec phan tho tai cong truong',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...(overrides as object),
  } as never);
}

describe('TradeEntity ORG-SRS-003', () => {
  it('tạo trade hợp lệ và assignable khi ACTIVE', () => {
    const t = makeTrade();
    expect(t.isActiveStatus()).toBe(true);
    expect(t.isAssignable()).toBe(true);
    expect(t.status).toBe('ACTIVE');
    expect(t.toPublic().assignable).toBe(true);
  });

  it('INACTIVE trade không assignable cho phân công mới', () => {
    const t = makeTrade({ isActive: false });
    expect(t.isInactive()).toBe(true);
    expect(t.isAssignable()).toBe(false);
    expect(t.toPublic().assignable).toBe(false);
  });

  it('validate code: trống, quá ngắn, ký tự không hợp lệ, quá dài bị reject', () => {
    expect(() => makeTrade({ code: '' })).toThrow('không được để trống');
    expect(() => makeTrade({ code: 'A' })).toThrow('2 đến 50');
    expect(() => makeTrade({ code: 'TRD 001' })).toThrow('chỉ cho phép');
    expect(() => makeTrade({ code: 'T'.repeat(51) })).toThrow('2 đến 50');
  });

  it('validate name: trống hoặc quá dài bị reject', () => {
    expect(() => makeTrade({ name: '' })).toThrow('không được để trống');
    expect(() => makeTrade({ name: '   ' })).toThrow('không được để trống');
    expect(() => makeTrade({ name: 'A'.repeat(121) })).toThrow('120');
  });

  it('validate description: quá 500 ký tự bị reject; rỗng/null được chuẩn hóa về null', () => {
    expect(() => makeTrade({ description: 'a'.repeat(501) })).toThrow('500');
    expect(makeTrade({ description: null }).description).toBeNull();
    expect(makeTrade({ description: '   ' }).description).toBeNull();
  });

  it('updateDetails đổi tên/mô tả và giữ updatedAt mới', () => {
    const t = makeTrade();
    const before = t.updatedAt;
    t.updateDetails({ name: 'Hoan thien nha xuong', description: 'Mo ta moi' }, new Date('2026-02-01T00:00:00Z'));
    expect(t.name).toBe('Hoan thien nha xuong');
    expect(t.description).toBe('Mo ta moi');
    expect(t.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  it('updateDetails reject tên trống', () => {
    const t = makeTrade();
    expect(() => t.updateDetails({ name: '   ' })).toThrow('không được để trống');
  });

  it('changeStatus ACTIVE->INACTIVE chuyển đúng và không assignable', () => {
    const t = makeTrade();
    t.changeStatus('INACTIVE', new Date('2026-03-01T00:00:00Z'));
    expect(t.status).toBe('INACTIVE');
    expect(t.isAssignable()).toBe(false);
  });

  it('changeStatus INACTIVE->ACTIVE reactivate bình thường', () => {
    const t = makeTrade({ isActive: false });
    t.changeStatus('ACTIVE');
    expect(t.status).toBe('ACTIVE');
    expect(t.isAssignable()).toBe(true);
  });

  it('changeStatus trùng trạng thái bị reject; status không hợp lệ bị reject', () => {
    expect(() => makeTrade().changeStatus('ACTIVE')).toThrow('đã ở trạng thái ACTIVE');
    expect(() => makeTrade({ isActive: false }).changeStatus('INACTIVE')).toThrow('đã ở trạng thái INACTIVE');
    expect(() => makeTrade().changeStatus('UNKNOWN' as never)).toThrow('không hợp lệ');
  });

  it('id không hợp lệ bị reject', () => {
    expect(() => makeTrade({ id: 'not-a-uuid' })).toThrow('ID ngành nghề');
  });

  it('lịch sử cũ vẫn giữ khi inactive (không hard delete)', () => {
    const t = makeTrade();
    t.changeStatus('INACTIVE');
    expect(t.id).toBe('11111111-1111-4111-8111-111111111111');
    expect(t.code).toBe('TRD-001');
    expect(t.name).toBe('Xay dung phan tho');
  });
});