import { UpdateWorkOrderTemplateUseCase } from './update-work-order-template.use-case';
import { WorkOrderTemplateEntity } from '../../domain/entity/work-order-template.entity';

function makeEntity(status: 'DRAFT' | 'ACTIVE' = 'ACTIVE'): WorkOrderTemplateEntity {
  const empty = status === 'DRAFT';
  return new WorkOrderTemplateEntity({
    id: '11111111-1111-4111-8111-111111111111',
    code: 'SLAB-POUR',
    name: 'Đổ sàn',
    description: null,
    workTypeId: null,
    requiredTradeId: null,
    defaultDurationMinutes: 120,
    defaultPriority: 'NORMAL',
    // ACTIVE fixture giữ nội dung để qua guard rỗng (review P2-1 issue #39);
    // DRAFT fixture để trống để chứng minh cho phép rỗng.
    requiredSkills: empty ? [] : [{ code: 'MASON', label: 'Thợ nề' }],
    checklistSnapshot: [],
    sourceChecklistTemplateId: null,
    status,
    version: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeHarness(entity: WorkOrderTemplateEntity | null, overrides?: Record<string, jest.Mock>) {
  const repo = {
    findById: jest.fn(async () => entity),
    findByCode: jest.fn(async () => null),
    findActiveTradeById: jest.fn(async () => null),
    findActiveTradeByCode: jest.fn(async () => null),
    findActiveWorkTypeById: jest.fn(async () => null),
    findChecklistTemplateSnapshot: jest.fn(async () => null),
    findWorkTypeRefs: jest.fn(async () => new Map()),
    save: jest.fn(async () => {}),
    saveWithClient: jest.fn(async () => {}),
    ...overrides,
  } as never;
  const audit = { logWithClient: jest.fn(async () => {}) };
  const tx = { withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn({}) };
  const uc = new UpdateWorkOrderTemplateUseCase(repo, audit as never, tx as never);
  return { repo, audit, uc };
}

const base = {
  templateId: '11111111-1111-4111-8111-111111111111',
  actorUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

describe('UpdateWorkOrderTemplateUseCase (PRJ-SRS-008)', () => {
  it('đổi name → version +1 + audit PRJ_WO_TEMPLATE_UPDATED', async () => {
    const { audit, uc } = makeHarness(makeEntity());
    const { entity, versionChanged } = await uc.execute({ ...base, name: 'Đổ sàn tầng 2' });
    expect(versionChanged).toBe(true);
    expect(entity.version).toBe(4);
    expect(audit.logWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'PRJ_WO_TEMPLATE_UPDATED', entityType: 'WORK_ORDER_TEMPLATE' }),
    );
  });

  it('expectedVersion mismatch → 409 WORK_ORDER_TEMPLATE_CONFIG_CONFLICT', async () => {
    const { uc } = makeHarness(makeEntity());
    await expect(uc.execute({ ...base, name: 'X', expectedVersion: 2 })).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({ code: 'WORK_ORDER_TEMPLATE_CONFIG_CONFLICT' }),
    });
  });

  it('đổi checklist → version +1; chỉ đổi provenance → không bump', async () => {
    const { uc } = makeHarness(makeEntity());
    const changed = await uc.execute({
      ...base,
      expectedVersion: 3,
      checklistSnapshot: [{ title: 'An toàn', answerType: 'YES_NO', isRequired: true, isBlocking: false, sequenceNo: 1 }],
    });
    expect(changed.versionChanged).toBe(true);
    expect(changed.entity.version).toBe(4);
  });

  it('no-op → không audit, versionChanged false', async () => {
    const { audit, uc } = makeHarness(makeEntity());
    const out = await uc.execute({ ...base, name: 'Đổ sàn' });
    expect(out.versionChanged).toBe(false);
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('404 khi template không tồn tại', async () => {
    const { uc } = makeHarness(null);
    await expect(uc.execute({ ...base })).rejects.toMatchObject({ status: 404 });
  });

  it('trùng code với mẫu khác → 409 WORK_ORDER_TEMPLATE_CODE_DUPLICATE', async () => {
    const other = new WorkOrderTemplateEntity({
      id: '99999999-9999-4999-8999-999999999999',
      code: 'OTHER',
      name: 'Khác',
      description: null,
      workTypeId: null,
      requiredTradeId: null,
      defaultDurationMinutes: null,
      defaultPriority: 'NORMAL',
      requiredSkills: [],
      checklistSnapshot: [],
      sourceChecklistTemplateId: null,
      status: 'DRAFT',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const { uc } = makeHarness(makeEntity(), { findByCode: jest.fn(async () => other) });
    await expect(uc.execute({ ...base, code: 'OTHER' })).rejects.toMatchObject({ status: 409 });
  });

  it('ACTIVE làm rỗng cả skills + checklist → 400 WORK_ORDER_TEMPLATE_EMPTY', async () => {
    const { audit, uc } = makeHarness(makeEntity('ACTIVE'));
    await expect(uc.execute({ ...base, requiredSkills: [], checklistSnapshot: [] })).rejects.toMatchObject({
      status: 400,
      response: expect.objectContaining({
        code: 'WORK_ORDER_TEMPLATE_EMPTY',
        fieldErrors: expect.objectContaining({ requiredSkills: expect.anything(), checklistSnapshot: expect.anything() }),
      }),
    });
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('DRAFT làm rỗng cả skills + checklist → ok (cho phép nháp trống)', async () => {
    const { uc } = makeHarness(makeEntity('DRAFT'));
    const out = await uc.execute({ ...base, name: 'Đổ sàn tầng 2', requiredSkills: [], checklistSnapshot: [] });
    expect(out.versionChanged).toBe(true);
    expect(out.entity.requiredSkills).toEqual([]);
    expect(out.entity.checklistSnapshot).toEqual([]);
  });
});
