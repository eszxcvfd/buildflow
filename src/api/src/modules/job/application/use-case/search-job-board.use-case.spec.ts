import { InternalServerErrorException } from '@nestjs/common';
import { SearchJobBoardUseCase } from './search-job-board.use-case';
import { WorkOrderEntity } from '../../domain/entity/work-order.entity';

const P1 = '22222222-2222-4222-8222-222222222222';
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

function setup(accessibleIds: string[] | null) {
  const e1 = makeEntity('11111111-1111-4111-8111-111111111111');
  const searchJobBoard = jest.fn(async () => ({ entities: [e1], total: 1 }));
  const repo = {
    searchJobBoard,
    hasActiveAssignmentByWorkOrderIds: jest.fn(async () => new Set<string>()),
    findWorkTypeRefs: jest.fn(async () => new Map([[TYPE_ID, { id: TYPE_ID, code: 'WT-001', name: 'Do be tong' }]])),
    findProjectRefs: jest.fn(async () => new Map([[P1, { id: P1, code: 'PRJ-001', name: 'Du an 1' }]])),
    findAreaRefs: jest.fn(async () => new Map([[AREA_ID, { id: AREA_ID, code: 'A-01', name: 'Khu A' }]])),
    findTradeRefs: jest.fn(async () => new Map([[TRADE_ID, { id: TRADE_ID, code: 'TR-01', name: 'Tho xay' }]])),
  };
  const scope = {
    resolveAccessibleProjectIds: jest.fn(async () => accessibleIds),
  };
  const useCase = new SearchJobBoardUseCase(repo as never, scope as never);
  return { useCase, searchJobBoard, repo, scope, e1 };
}

describe('SearchJobBoardUseCase (JOB-SRS-005 #45)', () => {
  it('ADMIN (null = unrestricted): searchJobBoard không projectIds, kèm 4 batch refs + assignment set', async () => {
    const { useCase, searchJobBoard, repo } = setup(null);
    const out = await useCase.execute({ actorUserId: ACTOR, actorRoles: ['ADMIN'] });
    expect(searchJobBoard).toHaveBeenCalledWith(
      expect.objectContaining({ projectIds: undefined, limit: 20, offset: 0, now: expect.any(Date) }),
    );
    expect(out.total).toBe(1);
    expect(out.workTypeRefs.get(TYPE_ID)?.name).toBe('Do be tong');
    expect(out.projectRefs.get(P1)?.name).toBe('Du an 1');
    expect(out.areaRefs.get(AREA_ID)?.name).toBe('Khu A');
    expect(out.tradeRefs.get(TRADE_ID)?.name).toBe('Tho xay');
    expect(out.activeAssignmentIds).toBeInstanceOf(Set);
    expect(repo.hasActiveAssignmentByWorkOrderIds).toHaveBeenCalledWith([out.entities[0].id]);
    expect(repo.findAreaRefs).toHaveBeenCalledWith([AREA_ID]);
    expect(repo.findTradeRefs).toHaveBeenCalledWith([TRADE_ID]);
  });

  it('non-ADMIN: scope projectIds = membership, forward limit/offset', async () => {
    const { useCase, searchJobBoard } = setup([P1]);
    await useCase.execute({ actorUserId: ACTOR, actorRoles: ['WORKER'], limit: 10, offset: 5 });
    expect(searchJobBoard).toHaveBeenCalledWith(
      expect.objectContaining({ projectIds: [P1], limit: 10, offset: 5 }),
    );
  });

  it('non-ADMIN membership rỗng → [] total 0, không query repo (không 403 — BD2)', async () => {
    const { useCase, searchJobBoard, repo } = setup([]);
    const out = await useCase.execute({ actorUserId: ACTOR, actorRoles: ['WORKER'] });
    expect(out.entities).toEqual([]);
    expect(out.total).toBe(0);
    expect(out.activeAssignmentIds.size).toBe(0);
    expect(searchJobBoard).not.toHaveBeenCalled();
    expect(repo.findWorkTypeRefs).not.toHaveBeenCalled();
    expect(repo.hasActiveAssignmentByWorkOrderIds).not.toHaveBeenCalled();
  });

  it('`now` capture MỘT lần: cùng instant cho SQL lẫn output (mapper derive state)', async () => {
    const { useCase, searchJobBoard } = setup([P1]);
    const before = Date.now();
    const out = await useCase.execute({ actorUserId: ACTOR, actorRoles: ['WORKER'] });
    const after = Date.now();
    const sentNow = (searchJobBoard.mock.calls[0] as unknown[])[0] as { now: Date };
    expect(sentNow.now).toBe(out.now);
    expect(sentNow.now.getTime()).toBeGreaterThanOrEqual(before);
    expect(sentNow.now.getTime()).toBeLessThanOrEqual(after);
  });

  it('item bị claim giữa page-SQL và enrichment → activeAssignmentIds chứa id (BD5 "báo rõ")', async () => {
    const { useCase, repo, e1 } = setup([P1]);
    repo.hasActiveAssignmentByWorkOrderIds.mockResolvedValueOnce(new Set([e1.id]));
    const out = await useCase.execute({ actorUserId: ACTOR, actorRoles: ['WORKER'] });
    expect(out.activeAssignmentIds.has(e1.id)).toBe(true);
    expect(out.entities).toHaveLength(1);
  });

  it('repo thiếu searchJobBoard → 500 fail-closed (F002, mirror #44 open hasAssignment guard)', async () => {
    const legacyRepo = {
      findWorkTypeRefs: jest.fn(async () => new Map()),
      findProjectRefs: jest.fn(async () => new Map()),
    };
    const scope = { resolveAccessibleProjectIds: jest.fn(async () => [P1]) };
    const useCase = new SearchJobBoardUseCase(legacyRepo as never, scope as never);
    await expect(
      useCase.execute({ actorUserId: ACTOR, actorRoles: ['WORKER'] }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('repo thiếu method tùy chọn mới (fake cũ) → fallback rỗng, không vỡ', async () => {
    const e1 = makeEntity('11111111-1111-4111-8111-111111111111');
    const legacyRepo = {
      searchJobBoard: jest.fn(async () => ({ entities: [e1], total: 1 })),
      findWorkTypeRefs: jest.fn(async () => new Map()),
      findProjectRefs: jest.fn(async () => new Map()),
    };
    const scope = { resolveAccessibleProjectIds: jest.fn(async () => [P1]) };
    const useCase = new SearchJobBoardUseCase(legacyRepo as never, scope as never);
    const out = await useCase.execute({ actorUserId: ACTOR, actorRoles: ['WORKER'] });
    expect(out.total).toBe(1);
    expect(out.activeAssignmentIds.size).toBe(0);
    expect(out.areaRefs.size).toBe(0);
    expect(out.tradeRefs.size).toBe(0);
  });
});
