import { WorkTypeEntity } from '../../../../domain/entity/work-type.entity';
import { toWorkTypeListResponse, toWorkTypeResponse } from './work-type.mapper';

function makeEntity(): WorkTypeEntity {
  return new WorkTypeEntity({
    id: '11111111-1111-4111-8111-111111111111',
    code: 'CONCRETE',
    name: 'Đổ bê tông',
    description: 'Mô tả',
    group: 'Kết cấu',
    requiredTradeId: '22222222-2222-4222-8222-222222222222',
    requiredFields: [{ key: 'photo', label: 'Ảnh', type: 'PHOTO', required: true }],
    configVersion: 2,
    defaultDurationMinutes: 120,
    defaultPriority: 'HIGH',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  });
}

describe('work-type.mapper (PRJ-SRS-004)', () => {
  it('map full profile: group/trade/requiredFields/version/duration/priority', () => {
    const dto = toWorkTypeResponse(makeEntity(), { usage: { workOrders: 0 } });
    expect(dto).toMatchObject({
      code: 'CONCRETE',
      group: 'Kết cấu',
      requiredTradeId: '22222222-2222-4222-8222-222222222222',
      configVersion: 2,
      defaultDurationMinutes: 120,
      defaultPriority: 'HIGH',
      status: 'ACTIVE',
      usableForNewWorkOrder: true,
      usage: { workOrders: 0 },
    });
    expect(dto.requiredFields).toEqual([{ key: 'photo', label: 'Ảnh', type: 'PHOTO', required: true, options: undefined }]);
    expect(dto.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(dto.warning).toBeUndefined();
    expect(dto.alreadyInState).toBeUndefined();
  });

  it('gắn warning/alreadyInState khi có options', () => {
    const dto = toWorkTypeResponse(makeEntity(), { warning: 'w', alreadyInState: false });
    expect(dto.warning).toBe('w');
    expect(dto.alreadyInState).toBe(false);
  });

  it('list map từng entity', () => {
    expect(toWorkTypeListResponse([makeEntity(), makeEntity()])).toHaveLength(2);
  });
});
