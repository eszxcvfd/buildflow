import { WorkOrderTemplateEntity } from '../../../../domain/entity/work-order-template.entity';
import {
  toWorkOrderTemplateListResponse,
  toWorkOrderTemplateResponse,
} from './work-order-template.mapper';

function makeEntity(): WorkOrderTemplateEntity {
  return new WorkOrderTemplateEntity({
    id: '11111111-1111-4111-8111-111111111111',
    code: 'SLAB-POUR',
    name: 'Đổ sàn',
    description: 'Mô tả',
    workTypeId: '22222222-2222-4222-8222-222222222222',
    requiredTradeId: null,
    defaultDurationMinutes: 120,
    defaultPriority: 'HIGH',
    requiredSkills: [{ code: 'MASON', label: 'Thợ nề' }],
    checklistSnapshot: [
      { title: 'An toàn', answerType: 'YES_NO', isRequired: true, isBlocking: true, sequenceNo: 1 },
    ],
    sourceChecklistTemplateId: null,
    status: 'ACTIVE',
    version: 2,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  });
}

describe('work-order-template.mapper (PRJ-SRS-008)', () => {
  it('map đủ field + ISO timestamps + usableForNewWorkOrder', () => {
    const dto = toWorkOrderTemplateResponse(makeEntity());
    expect(dto).toMatchObject({
      code: 'SLAB-POUR',
      status: 'ACTIVE',
      version: 2,
      usableForNewWorkOrder: true,
      defaultPriority: 'HIGH',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(dto.requiredSkills).toEqual([{ code: 'MASON', label: 'Thợ nề' }]);
    expect(dto.checklistSnapshot[0]).toMatchObject({ answerType: 'YES_NO', sequenceNo: 1 });
  });

  it('alreadyInState chỉ kèm khi truyền options', () => {
    expect(toWorkOrderTemplateResponse(makeEntity()).alreadyInState).toBeUndefined();
    expect(toWorkOrderTemplateResponse(makeEntity(), { alreadyInState: true }).alreadyInState).toBe(true);
  });

  it('list map từng entity', () => {
    expect(toWorkOrderTemplateListResponse([makeEntity(), makeEntity()])).toHaveLength(2);
  });
});
