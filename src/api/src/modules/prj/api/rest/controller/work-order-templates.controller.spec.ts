import { ForbiddenException } from '@nestjs/common';
import { WorkOrderTemplatesController } from './work-order-templates.controller';
import { WorkOrderTemplateEntity } from '../../../domain/entity/work-order-template.entity';

const TPL_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function makeEntity(): WorkOrderTemplateEntity {
  return new WorkOrderTemplateEntity({
    id: TPL_ID,
    code: 'SLAB-POUR',
    name: 'Đổ sàn',
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
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

function reqWithRoles(roles: string[]): unknown {
  return { user: { sub: ADMIN_ID, roles }, headers: {}, ip: '127.0.0.1' };
}

describe('WorkOrderTemplatesController (PRJ-SRS-008)', () => {
  function setup() {
    const createTemplate = { execute: jest.fn(async () => ({ entity: makeEntity() })) };
    const searchTemplates = { execute: jest.fn(async () => ({ entities: [makeEntity()], total: 1 })) };
    const getTemplate = { execute: jest.fn(async () => ({ entity: makeEntity() })) };
    const updateTemplate = { execute: jest.fn(async () => ({ entity: makeEntity(), versionChanged: false })) };
    const changeTemplateStatus = { execute: jest.fn(async () => ({ entity: makeEntity(), alreadyInState: false })) };
    const listActiveTemplates = { execute: jest.fn(async () => ({ entities: [makeEntity()] })) };
    const controller = new WorkOrderTemplatesController(
      createTemplate as never,
      searchTemplates as never,
      getTemplate as never,
      updateTemplate as never,
      changeTemplateStatus as never,
      listActiveTemplates as never,
    );
    return { controller, createTemplate, searchTemplates, updateTemplate, changeTemplateStatus };
  }

  it('POST create: ADMIN/PM được; WORKER 403', async () => {
    const { controller } = setup();
    const res = await controller.create(
      { code: 'SLAB-POUR', name: 'Đổ sàn' } as never,
      reqWithRoles(['ADMIN']) as never,
    );
    expect(res.code).toBe('SLAB-POUR');
    expect(res.status).toBe('DRAFT');
    await expect(
      controller.create({ code: 'X', name: 'Y' } as never, reqWithRoles(['WORKER']) as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('GET search/active/detail: PM đọc được; query sai → 400 fieldErrors', async () => {
    const { controller } = setup();
    const list = await controller.search(reqWithRoles(['PROJECT_MANAGER']) as never, 'ACTIVE', undefined, undefined, undefined, undefined);
    expect(list.total).toBe(1);
    const picker = await controller.listActive(reqWithRoles(['PROJECT_MANAGER']) as never);
    expect(picker.total).toBe(1);
    const detail = await controller.getOne(TPL_ID, reqWithRoles(['ADMIN']) as never);
    expect(detail.id).toBe(TPL_ID);
    await expect(
      controller.search(reqWithRoles(['ADMIN']) as never, 'WRONG', undefined, undefined, undefined, undefined),
    ).rejects.toMatchObject({ response: expect.objectContaining({ fieldErrors: expect.anything() }) });
    await expect(
      controller.search(reqWithRoles(['ADMIN']) as never, undefined, 'not-a-uuid', undefined, undefined, undefined),
    ).rejects.toMatchObject({ response: expect.objectContaining({ fieldErrors: expect.anything() }) });
  });

  it('PATCH update + POST status: wire expectedVersion/action', async () => {
    const { controller, updateTemplate, changeTemplateStatus } = setup();
    await controller.update(TPL_ID, { name: 'Mới', expectedVersion: 1 } as never, reqWithRoles(['ADMIN']) as never);
    expect(updateTemplate.execute).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 1 }));
    await controller.changeStatus(TPL_ID, { action: 'ACTIVATE' } as never, reqWithRoles(['PROJECT_MANAGER']) as never);
    expect(changeTemplateStatus.execute).toHaveBeenCalledWith(expect.objectContaining({ action: 'ACTIVATE' }));
  });

  it('X-Correlation-Id sai UUID trên write → 400', async () => {
    const { controller } = setup();
    const req = { user: { sub: ADMIN_ID, roles: ['ADMIN'] }, headers: { 'x-correlation-id': 'not-uuid' }, ip: '127.0.0.1' };
    await expect(
      controller.create({ code: 'A', name: 'B' } as never, req as never),
    ).rejects.toMatchObject({ status: 400 });
  });
});
