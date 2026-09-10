import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { SearchJobBoardUseCase } from './search-job-board.use-case';
import { WorkOrderEntity } from '../../domain/entity/work-order.entity';

const P1 = '22222222-2222-4222-8222-222222222222';
const P2 = '99999999-9999-4999-8999-999999999999';
const TYPE_ID = '44444444-4444-4444-8444-444444444444';
const AREA_ID = '55555555-5555-4555-8555-555555555555';
const TRADE_ID = '66666666-6666-4666-8666-666666666666';
const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function makeEntity(id: string): WorkOrderEntity {
  return new WorkOrderEntity({
    id,
    code: `WO-${id.slice(0, 4).toUpperCase()}`,
    projectId: P1,
    areaId: AREA_ID,
    workTypeId: TYPE_ID,
    requiredTradeId: TRADE_ID,
    title: `Viec ${id.slice(0, 4)}`,
    description: null,
    instructions: null,
    priority: 'NORMAL',
    status: 'OPEN',
    plannedStartAt: null,
    plannedEndAt: null,
    dueAt: null,
    plannedHeadcount: null,
    customFields: {},
    createdBy: ACTOR,
    version: 1,
    requestKey: null,
    jobBoardOpen: true,
    jobBoardOpenFrom: null,
    jobBoardOpenUntil: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

function setup(accessibleIds: string[] | null, trades: string[] = [TRADE_ID]) {
  const e1 = makeEntity('11111111-1111-4111-8111-111111111111');
  const searchJobBoard = jest.fn(async () => ({ entities: [e1], total: 1 }));
  const repo = {
    searchJobBoard,
    findActiveTradeIdsByUserId: jest.fn(async () => trades),
    hasActiveAssignmentByWorkOrderIds: jest.fn(async () => new Set<string>()),
    findWorkTypeRefs: jest.fn(async () => new Map()),
    findProjectRefs: jest.fn(async () => new Map()),
    findAreaRefs: jest.fn(async () => new Map()),
    findTradeRefs: jest.fn(async () => new Map()),
  };
  const scope = {
    resolveAccessibleProjectIds: jest.fn(async () => accessibleIds),
  };
  const useCase = new SearchJobBoardUseCase(repo as never, scope as never);
  return { useCase, searchJobBoard, repo, scope, e1 };
}

describe('SearchJobBoardUseCase filters (JOB-SRS-006 #46)', () => {
  it('projectId ∈ scope → forward projectId + scope (AND trong SQL)', async () => {
    const { useCase, searchJobBoard } = setup([P1]);
    await useCase.execute({ actorUserId: ACTOR, actorRoles: ['WORKER'], projectId: P1 });
    expect(searchJobBoard).toHaveBeenCalledWith(
      expect.objectContaining({ projectIds: [P1], projectId: P1 }),
    );
  });

  it('projectId ∉ scope (non-ADMIN) → 403 generic, không query', async () => {
    const { useCase, searchJobBoard } = setup([P1]);
    await expect(
      useCase.execute({ actorUserId: ACTOR, actorRoles: ['WORKER'], projectId: P2 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(searchJobBoard).not.toHaveBeenCalled();
  });

  it('membership rỗng + gửi projectId → 403 (khác BD2: BD2 chỉ khi KHÔNG gửi filter)', async () => {
    const { useCase, searchJobBoard } = setup([]);
    await expect(
      useCase.execute({ actorUserId: ACTOR, actorRoles: ['WORKER'], projectId: P1 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(searchJobBoard).not.toHaveBeenCalled();
  });

  it('membership rỗng + KHÔNG gửi projectId → 200 empty (BD2 giữ nguyên)', async () => {
    const { useCase, searchJobBoard } = setup([]);
    const out = await useCase.execute({ actorUserId: ACTOR, actorRoles: ['WORKER'] });
    expect(out.entities).toEqual([]);
    expect(out.total).toBe(0);
    expect(searchJobBoard).not.toHaveBeenCalled();
  });

  it('ADMIN + projectId (kể cả không tồn tại) → forward, không 403/404', async () => {
    const { useCase, searchJobBoard } = setup(null);
    await useCase.execute({ actorUserId: ACTOR, actorRoles: ['ADMIN'], projectId: P2 });
    expect(searchJobBoard).toHaveBeenCalledWith(
      expect.objectContaining({ projectIds: undefined, projectId: P2 }),
    );
  });

  it('skill=mine → resolve trades rồi forward requiredTradeIds', async () => {
    const { useCase, searchJobBoard, repo } = setup([P1], [TRADE_ID]);
    await useCase.execute({ actorUserId: ACTOR, actorRoles: ['WORKER'], skillMine: true });
    expect(repo.findActiveTradeIdsByUserId).toHaveBeenCalledWith(ACTOR);
    expect(searchJobBoard).toHaveBeenCalledWith(
      expect.objectContaining({ requiredTradeIds: [TRADE_ID] }),
    );
  });

  it('skill=mine khi không trade active → 200 empty, không query search', async () => {
    const { useCase, searchJobBoard, repo } = setup([P1], []);
    const out = await useCase.execute({ actorUserId: ACTOR, actorRoles: ['WORKER'], skillMine: true });
    expect(out.entities).toEqual([]);
    expect(out.total).toBe(0);
    expect(repo.findActiveTradeIdsByUserId).toHaveBeenCalledWith(ACTOR);
    expect(searchJobBoard).not.toHaveBeenCalled();
  });

  it('skill=mine mà port thiếu findActiveTradeIdsByUserId → 500 fail-closed', async () => {
    const e1 = makeEntity('11111111-1111-4111-8111-111111111111');
    const legacyRepo = {
      searchJobBoard: jest.fn(async () => ({ entities: [e1], total: 1 })),
      findWorkTypeRefs: jest.fn(async () => new Map()),
      findProjectRefs: jest.fn(async () => new Map()),
    };
    const scope = { resolveAccessibleProjectIds: jest.fn(async () => [P1]) };
    const useCase = new SearchJobBoardUseCase(legacyRepo as never, scope as never);
    await expect(
      useCase.execute({ actorUserId: ACTOR, actorRoles: ['WORKER'], skillMine: true }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('forward areaIds/workTypeIds/plannedFrom/plannedTo sang repo', async () => {
    const { useCase, searchJobBoard } = setup([P1]);
    const from = new Date('2026-10-01T00:00:00.000Z');
    const to = new Date('2026-10-31T00:00:00.000Z');
    await useCase.execute({
      actorUserId: ACTOR,
      actorRoles: ['WORKER'],
      areaIds: [AREA_ID],
      workTypeIds: [TYPE_ID],
      plannedFrom: from,
      plannedTo: to,
    });
    expect(searchJobBoard).toHaveBeenCalledWith(
      expect.objectContaining({
        areaIds: [AREA_ID],
        workTypeIds: [TYPE_ID],
        plannedFrom: from,
        plannedTo: to,
        requiredTradeIds: undefined,
      }),
    );
  });
});
