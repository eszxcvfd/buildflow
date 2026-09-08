import { ForbiddenException } from '@nestjs/common';
import { WorkTypesController } from './work-types.controller';
import { WorkTypeEntity } from '../../../domain/entity/work-type.entity';

const WT_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function makeEntity(): WorkTypeEntity {
  return new WorkTypeEntity({
    id: WT_ID,
    code: 'CONCRETE',
    name: 'Đổ bê tông',
    description: null,
    group: null,
    requiredTradeId: null,
    requiredFields: [],
    configVersion: 1,
    defaultDurationMinutes: null,
    defaultPriority: 'NORMAL',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

function reqWithRoles(roles: string[]): unknown {
  return { user: { sub: ADMIN_ID, roles }, headers: {}, ip: '127.0.0.1' };
}

describe('WorkTypesController (PRJ-SRS-004)', () => {
  function setup() {
    const createWorkType = { execute: jest.fn(async () => ({ entity: makeEntity() })) };
    const searchWorkTypes = { execute: jest.fn(async () => ({ entities: [makeEntity()], total: 1 })) };
    const getWorkType = { execute: jest.fn(async () => ({ entity: makeEntity(), usage: { workOrders: 0 } })) };
    const updateWorkType = { execute: jest.fn(async () => ({ entity: makeEntity(), versionChanged: false })) };
    const changeWorkTypeStatus = { execute: jest.fn(async () => ({ entity: makeEntity(), alreadyInState: false })) };
    const listActiveWorkTypes = { execute: jest.fn(async () => ({ entities: [makeEntity()] })) };
    const controller = new WorkTypesController(
      createWorkType as never,
      searchWorkTypes as never,
      getWorkType as never,
      updateWorkType as never,
      changeWorkTypeStatus as never,
      listActiveWorkTypes as never,
    );
    return { controller, createWorkType, searchWorkTypes, getWorkType, updateWorkType, changeWorkTypeStatus, listActiveWorkTypes };
  }

  it('POST create: ADMIN/PM được; WORKER 403', async () => {
    const { controller } = setup();
    const res = await controller.create(
      { code: 'CONCRETE', name: 'Đổ bê tông' } as never,
      reqWithRoles(['ADMIN']) as never,
    );
    expect(res.code).toBe('CONCRETE');
    await expect(
      controller.create({ code: 'X', name: 'Y' } as never, reqWithRoles(['WORKER']) as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('GET search/active/detail: PM đọc được; query sai → 400 fieldErrors', async () => {
    const { controller } = setup();
    const list = await controller.search(reqWithRoles(['PROJECT_MANAGER']) as never, 'ACTIVE', undefined, undefined, undefined, undefined, undefined);
    expect(list.total).toBe(1);
    const picker = await controller.listActive(reqWithRoles(['PROJECT_MANAGER']) as never);
    expect(picker.total).toBe(1);
    const detail = await controller.getOne(WT_ID, reqWithRoles(['ADMIN']) as never);
    expect(detail.usage).toEqual({ workOrders: 0 });
    await expect(
      controller.search(reqWithRoles(['ADMIN']) as never, 'WRONG', undefined, undefined, undefined, undefined, undefined),
    ).rejects.toMatchObject({ response: expect.objectContaining({ fieldErrors: expect.anything() }) });
  });

  it('PATCH update + POST status: wire expectedConfigVersion/action', async () => {
    const { controller, updateWorkType, changeWorkTypeStatus } = setup();
    await controller.update(WT_ID, { name: 'Mới', expectedConfigVersion: 1 } as never, reqWithRoles(['ADMIN']) as never);
    expect(updateWorkType.execute).toHaveBeenCalledWith(expect.objectContaining({ expectedConfigVersion: 1 }));
    await controller.changeStatus(WT_ID, { action: 'DEACTIVATE' } as never, reqWithRoles(['PROJECT_MANAGER']) as never);
    expect(changeWorkTypeStatus.execute).toHaveBeenCalledWith(expect.objectContaining({ action: 'DEACTIVATE' }));
  });
});
