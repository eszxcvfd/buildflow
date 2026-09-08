import { ChangeWorkOrderTemplateStatusUseCase } from './change-work-order-template-status.use-case';
import { WorkOrderTemplateEntity } from '../../domain/entity/work-order-template.entity';

function makeEntity(status: 'DRAFT' | 'ACTIVE' | 'INACTIVE', withContent = true): WorkOrderTemplateEntity {
  return new WorkOrderTemplateEntity({
    id: '11111111-1111-4111-8111-111111111111',
    code: 'SLAB-POUR',
    name: 'Đổ sàn',
    description: null,
    workTypeId: null,
    requiredTradeId: null,
    defaultDurationMinutes: null,
    defaultPriority: 'NORMAL',
    requiredSkills: withContent ? [{ code: 'MASON', label: 'Thợ nề' }] : [],
    checklistSnapshot: [],
    sourceChecklistTemplateId: null,
    status,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function makeHarness(entity: WorkOrderTemplateEntity | null) {
  const repo = {
    findById: jest.fn(async () => entity),
    save: jest.fn(async () => {}),
    saveWithClient: jest.fn(async () => {}),
    findWorkTypeRefs: jest.fn(async () => new Map()),
  } as never;
  const audit = { logWithClient: jest.fn(async () => {}) };
  const tx = { withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn({}) };
  const uc = new ChangeWorkOrderTemplateStatusUseCase(repo, audit as never, tx as never);
  return { audit, uc };
}

const base = {
  templateId: '11111111-1111-4111-8111-111111111111',
  actorUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

describe('ChangeWorkOrderTemplateStatusUseCase (PRJ-SRS-008)', () => {
  it('DRAFT ACTIVATE → ACTIVE + audit PRJ_WO_TEMPLATE_STATUS_CHANGED', async () => {
    const { audit, uc } = makeHarness(makeEntity('DRAFT'));
    const { entity, alreadyInState } = await uc.execute({ ...base, action: 'ACTIVATE' });
    expect(alreadyInState).toBe(false);
    expect(entity.status).toBe('ACTIVE');
    expect(audit.logWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'PRJ_WO_TEMPLATE_STATUS_CHANGED', entityType: 'WORK_ORDER_TEMPLATE' }),
    );
  });

  it('repeat ACTIVATE → alreadyInState, không audit', async () => {
    const { audit, uc } = makeHarness(makeEntity('ACTIVE'));
    const out = await uc.execute({ ...base, action: 'ACTIVATE' });
    expect(out.alreadyInState).toBe(true);
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('ACTIVATE mẫu rỗng (thiếu skill + checklist) → 400 {action}', async () => {
    const { uc } = makeHarness(makeEntity('DRAFT', false));
    await expect(uc.execute({ ...base, action: 'ACTIVATE' })).rejects.toMatchObject({ status: 400 });
  });

  it('DEACTIVATE từ DRAFT → 400 {action}', async () => {
    const { uc } = makeHarness(makeEntity('DRAFT'));
    await expect(uc.execute({ ...base, action: 'DEACTIVATE' })).rejects.toMatchObject({ status: 400 });
  });

  it('ACTIVE DEACTIVATE → INACTIVE; INACTIVE ACTIVATE → ACTIVE (tái phát hành)', async () => {
    const h1 = makeHarness(makeEntity('ACTIVE'));
    expect((await h1.uc.execute({ ...base, action: 'DEACTIVATE' })).entity.status).toBe('INACTIVE');
    const h2 = makeHarness(makeEntity('INACTIVE'));
    expect((await h2.uc.execute({ ...base, action: 'ACTIVATE' })).entity.status).toBe('ACTIVE');
  });

  it('404 khi template không tồn tại', async () => {
    const { uc } = makeHarness(null);
    await expect(uc.execute({ ...base, action: 'ACTIVATE' })).rejects.toMatchObject({ status: 404 });
  });
});
