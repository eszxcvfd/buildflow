import { ProjectAreaEntity } from './project-area.entity';

const PID = '11111111-1111-4111-8111-111111111111';
const AID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function makeArea(overrides: Record<string, unknown> = {}): ProjectAreaEntity {
  return new ProjectAreaEntity({
    id: AID,
    projectId: PID,
    code: 'KV-01',
    name: 'Khu A',
    isActive: true,
    createdAt: new Date('2026-09-07T00:00:00.000Z'),
    updatedAt: new Date('2026-09-07T00:00:00.000Z'),
    ...overrides,
  } as never);
}

describe('ProjectAreaEntity PRJ-SRS-003 (issue #34)', () => {
  it('happy: giữ code/name/isActive, toPublic đủ trường', () => {
    const e = makeArea();
    expect(e.toPublic()).toEqual(
      expect.objectContaining({ id: AID, projectId: PID, code: 'KV-01', name: 'Khu A', isActive: true }),
    );
  });

  it('code optional: null/undefined/rỗng → null', () => {
    expect(makeArea({ code: null }).code).toBeNull();
    expect(makeArea({ code: undefined }).code).toBeNull();
    expect(makeArea({ code: '   ' }).code).toBeNull();
  });

  it('invariant: tên trống/quá dài → throw (use case map 400 fieldErrors {name})', () => {
    expect(() => makeArea({ name: '   ' })).toThrow('Tên khu vực không được để trống');
    expect(() => makeArea({ name: 'x'.repeat(151) })).toThrow('Tên khu vực tối đa 150 ký tự');
  });

  it('invariant: mã sai format/quá dài → throw (use case map 400 fieldErrors {code})', () => {
    expect(() => makeArea({ code: 'KV 01!' })).toThrow('Mã khu vực chỉ cho phép chữ, số, _ và -');
    expect(() => makeArea({ code: 'x'.repeat(51) })).toThrow('Mã khu vực tối đa 50 ký tự');
  });

  it('invariant: id/projectId sai uuid → throw', () => {
    expect(() => makeArea({ id: 'not-a-uuid' })).toThrow('ID khu vực không hợp lệ');
    expect(() => makeArea({ projectId: 'not-a-uuid' })).toThrow('ID dự án không hợp lệ');
  });

  it('rename đổi tên tại chỗ (giữ id/projectId); changeCode/changeActive đổi tại chỗ', () => {
    const e = makeArea();
    e.rename('Khu B');
    expect(e.name).toBe('Khu B');
    expect(e.id).toBe(AID);
    expect(e.projectId).toBe(PID);
    e.changeCode(null);
    expect(e.code).toBeNull();
    e.changeActive(false);
    expect(e.isActive).toBe(false);
    expect(() => e.rename('  ')).toThrow('Tên khu vực không được để trống');
  });
});
