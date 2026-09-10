import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { JobBoardController } from './job-board.controller';
import { WorkOrderEntity } from '../../../domain/entity/work-order.entity';

const IDS = {
  wo: '11111111-1111-4111-8111-111111111111',
  project: '22222222-2222-4222-8222-222222222222',
  project2: '99999999-9999-4999-8999-999999999999',
  area: '55555555-5555-4555-8555-555555555555',
  area2: '77777777-7777-4777-8777-777777777777',
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

describe('JobBoardController filters (JOB-SRS-006 #46)', () => {
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
    const filterOptions = {
      execute: jest.fn(async () => ({
        projects: [{ id: IDS.project, name: 'Du an 1' }],
        areas: [],
        workTypes: [],
        trades: [],
        now: new Date('2026-11-01T08:00:00.000Z'),
      })),
    };
    const controller = new JobBoardController(searchJobBoard as never, filterOptions as never);
    return { controller, searchJobBoard, filterOptions };
  }

  it('không filter → forward undefined (hành vi #45 nguyên vẹn)', async () => {
    const { controller, searchJobBoard } = setup();
    await controller.list(reqWithUser() as never, undefined, undefined, {});
    expect(searchJobBoard.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: undefined,
        areaIds: undefined,
        workTypeIds: undefined,
        plannedFrom: undefined,
        plannedTo: undefined,
        skillMine: undefined,
      }),
    );
  });

  it(`'' = absent cho mọi filter param`, async () => {
    const { controller, searchJobBoard } = setup();
    await controller.list(reqWithUser() as never, undefined, undefined, {
      projectId: '',
      areaId: '',
      workTypeId: '',
      dateFrom: '',
      dateTo: '',
      skill: '',
    });
    expect(searchJobBoard.execute).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: undefined, areaIds: undefined, skillMine: undefined }),
    );
  });

  it('forward đủ 6 filter (areaId/workTypeId lặp) sang use case', async () => {
    const { controller, searchJobBoard } = setup();
    await controller.list(reqWithUser() as never, undefined, undefined, {
      projectId: IDS.project,
      areaId: [IDS.area, IDS.area2],
      workTypeId: IDS.workType,
      dateFrom: '2026-10-01T00:00:00+07:00',
      dateTo: '2026-10-31T23:59:59+07:00',
      skill: 'mine',
    });
    expect(searchJobBoard.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: IDS.project,
        areaIds: [IDS.area, IDS.area2],
        workTypeIds: [IDS.workType],
        plannedFrom: new Date('2026-10-01T00:00:00+07:00'),
        plannedTo: new Date('2026-10-31T23:59:59+07:00'),
        skillMine: true,
      }),
    );
  });

  it.each([
    [{ dateFrom: '2026-10-01T00:00:00' }, 'dateFrom'],
    [{ dateTo: '2026-10-01' }, 'dateTo'],
    [{ projectId: 'not-a-uuid' }, 'projectId'],
    [{ areaId: 'nope' }, 'areaId'],
    [{ areaId: [IDS.area, 'nope'] }, 'areaId'],
    [{ workTypeId: 'nope' }, 'workTypeId'],
    [{ skill: 'all' }, 'skill'],
  ])('query %j → 400 fieldErrors {%s}, không gọi use case', async (query, field) => {
    const { controller, searchJobBoard } = setup();
    const err = await controller
      .list(reqWithUser() as never, undefined, undefined, query as Record<string, unknown>)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    const body = (err as BadRequestException).getResponse() as Record<string, unknown>;
    expect(body['statusCode']).toBe(400);
    expect(body['fieldErrors']).toEqual({ [field]: expect.anything() });
    expect(searchJobBoard.execute).not.toHaveBeenCalled();
  });

  it('dateFrom > dateTo → 400 fieldErrors CẢ hai field', async () => {
    const { controller, searchJobBoard } = setup();
    const err = await controller
      .list(reqWithUser() as never, undefined, undefined, {
        dateFrom: '2026-10-05T00:00:00Z',
        dateTo: '2026-10-01T00:00:00Z',
      })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    const body = (err as BadRequestException).getResponse() as Record<string, unknown>;
    expect(body['statusCode']).toBe(400);
    expect(body['fieldErrors']).toEqual({
      dateFrom: expect.anything(),
      dateTo: expect.anything(),
    });
    expect(searchJobBoard.execute).not.toHaveBeenCalled();
  });

  it('F001: date filter sai (naive + from>to) → 400 có code JOB_BOARD_DATE_RANGE_INVALID', async () => {
    const { controller } = setup();
    for (const query of [
      { dateFrom: '2026-10-01T00:00:00' },
      { dateFrom: '2026-10-05T00:00:00Z', dateTo: '2026-10-01T00:00:00Z' },
    ]) {
      const err = await controller
        .list(reqWithUser() as never, undefined, undefined, query as Record<string, unknown>)
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      const body = (err as BadRequestException).getResponse() as Record<string, unknown>;
      expect(body['code']).toBe('JOB_BOARD_DATE_RANGE_INVALID');
    }
  });

  it('F001: filter không-date sai (projectId/skill) → 400 không có code', async () => {
    const { controller } = setup();
    const err = await controller
      .list(reqWithUser() as never, undefined, undefined, { projectId: 'not-a-uuid' })
      .catch((e: unknown) => e);
    const body = (err as BadRequestException).getResponse() as Record<string, unknown>;
    expect(body['statusCode']).toBe(400);
    expect(body).not.toHaveProperty('code');
  });

  it('unknown key (foo/projectId ngoài scope ở tầng controller) → ignore, vẫn 200', async () => {
    const { controller, searchJobBoard } = setup();
    const res = await controller.list(reqWithUser() as never, undefined, undefined, {
      foo: 'bar',
      search: 'x',
    });
    expect(res.total).toBe(1);
    expect(searchJobBoard.execute).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: undefined }),
    );
  });

  it('403 từ use case (projectId ngoài scope) → propagate', async () => {
    const { controller, searchJobBoard } = setup();
    searchJobBoard.execute.mockRejectedValueOnce(new ForbiddenException('Không có quyền truy cập dự án này'));
    await expect(
      controller.list(reqWithUser() as never, undefined, undefined, { projectId: IDS.project2 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('GET filter-options → forward actor + trả shape {now, projects, areas, workTypes, trades}', async () => {
    const { controller, filterOptions } = setup();
    const res = await controller.options(reqWithUser() as never);
    expect(filterOptions.execute).toHaveBeenCalledWith({
      actorUserId: IDS.actor,
      actorRoles: ['WORKER'],
    });
    // F002 (#46): `now` top-level là clock server, 4 mảng là nguồn picker.
    expect(typeof (res as { now: unknown }).now).toBe('object');
    expect((res as { now: Date }).now).toBeInstanceOf(Date);
    expect(res.projects).toEqual([{ id: IDS.project, name: 'Du an 1' }]);
    expect(res.areas).toEqual([]);
    expect(res.workTypes).toEqual([]);
    expect(res.trades).toEqual([]);
  });
});
