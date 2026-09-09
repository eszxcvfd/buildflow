import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JobBoardController } from './job-board.controller';
import { WorkOrderEntity } from '../../../domain/entity/work-order.entity';

const IDS = {
  wo: '11111111-1111-4111-8111-111111111111',
  project: '22222222-2222-4222-8222-222222222222',
  workType: '44444444-4444-4444-8444-444444444444',
  actor: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

function makeEntity(): WorkOrderEntity {
  return new WorkOrderEntity({
    id: IDS.wo,
    code: 'WO-2026-A1',
    projectId: IDS.project,
    areaId: null,
    workTypeId: IDS.workType,
    requiredTradeId: null,
    title: 'Do be tong cot C1',
    description: null,
    instructions: null,
    priority: 'NORMAL',
    status: 'OPEN',
    plannedStartAt: null,
    plannedEndAt: null,
    dueAt: null,
    plannedHeadcount: null,
    customFields: {},
    createdBy: IDS.actor,
    version: 1,
    requestKey: null,
    jobBoardOpen: true,
    jobBoardOpenFrom: null,
    jobBoardOpenUntil: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

function reqWithUser(): unknown {
  return {
    user: { sub: IDS.actor, email: 'worker@example.com', roles: ['WORKER'] },
    headers: {},
    ip: '127.0.0.1',
  };
}

describe('JobBoardController (JOB-SRS-005 #45)', () => {
  function setup() {
    const searchJobBoard = {
      execute: jest.fn(async () => ({
        entities: [makeEntity()],
        total: 1,
        now: new Date('2026-11-01T08:00:00.000Z'),
        activeAssignmentIds: new Set<string>(),
        workTypeRefs: new Map(),
        projectRefs: new Map(),
        areaRefs: new Map(),
        tradeRefs: new Map(),
      })),
    };
    const controller = new JobBoardController(searchJobBoard as never);
    return { controller, searchJobBoard };
  }

  it('forward limit/offset + actor server-derived, envelope default limit 20 offset 0', async () => {
    const { controller, searchJobBoard } = setup();
    const res = await controller.list(reqWithUser() as never, undefined, undefined);
    expect(searchJobBoard.execute).toHaveBeenCalledWith(
      expect.objectContaining({ limit: undefined, offset: undefined, actorUserId: IDS.actor, actorRoles: ['WORKER'] }),
    );
    expect(res.total).toBe(1);
    expect(res.limit).toBe(20);
    expect(res.offset).toBe(0);
    expect(res.data).toHaveLength(1);
    expect(res.data[0]).not.toHaveProperty('createdBy');
  });

  it.each([['0'], ['101'], ['abc'], ['2.5'], [' '], ['0x10'], ['1e2']])('limit=%s → 400 fieldErrors {limit}', async (limit) => {
    const { controller, searchJobBoard } = setup();
    await expect(controller.list(reqWithUser() as never, limit, undefined)).rejects.toMatchObject({
      response: expect.objectContaining({ fieldErrors: expect.objectContaining({ limit: expect.anything() }) }),
    });
    expect(searchJobBoard.execute).not.toHaveBeenCalled();
  });

  it.each([['-1'], ['xyz'], [' '], ['1.5'], ['0x10']])('offset=%s → 400 fieldErrors {offset}', async (offset) => {
    const { controller, searchJobBoard } = setup();
    await expect(controller.list(reqWithUser() as never, undefined, offset)).rejects.toMatchObject({
      response: expect.objectContaining({ fieldErrors: expect.objectContaining({ offset: expect.anything() }) }),
    });
    expect(searchJobBoard.execute).not.toHaveBeenCalled();
  });

  it('400 là BadRequestException (shape { statusCode, message, fieldErrors })', async () => {
    const { controller } = setup();
    const err = await controller.list(reqWithUser() as never, '0', undefined).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    const body = (err as BadRequestException).getResponse() as Record<string, unknown>;
    expect(body['statusCode']).toBe(400);
    expect(body['fieldErrors']).toEqual({ limit: ['Limit không hợp lệ (1-100)'] });
  });

  it('anon (không JWT user) → 401', async () => {
    const { controller, searchJobBoard } = setup();
    await expect(controller.list({ headers: {}, ip: '127.0.0.1' } as never, undefined, undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(searchJobBoard.execute).not.toHaveBeenCalled();
  });

  it('limit/offset hợp lệ → forward số nguyên', async () => {
    const { controller, searchJobBoard } = setup();
    const res = await controller.list(reqWithUser() as never, '10', '5');
    expect(searchJobBoard.execute).toHaveBeenCalledWith(expect.objectContaining({ limit: 10, offset: 5 }));
    expect(res.limit).toBe(10);
    expect(res.offset).toBe(5);
  });
});
