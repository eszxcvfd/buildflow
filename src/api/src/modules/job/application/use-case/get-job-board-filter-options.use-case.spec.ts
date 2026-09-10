import { InternalServerErrorException } from '@nestjs/common';
import { GetJobBoardFilterOptionsUseCase } from './get-job-board-filter-options.use-case';

const P1 = '22222222-2222-4222-8222-222222222222';
const AREA_ID = '55555555-5555-4555-8555-555555555555';
const TYPE_ID = '44444444-4444-4444-8444-444444444444';
const TRADE_ID = '66666666-6666-4666-8666-666666666666';
const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function setup(accessibleIds: string[] | null) {
  const findJobBoardFilterOptions = jest.fn(async () => ({
    projectIds: [P1],
    areaIds: [AREA_ID],
    workTypeIds: [TYPE_ID],
    tradeIds: [TRADE_ID],
  }));
  const repo = {
    findJobBoardFilterOptions,
    findWorkTypeRefs: jest.fn(
      async () => new Map([[TYPE_ID, { id: TYPE_ID, code: 'WT-001', name: 'Do be tong' }]]),
    ),
    findProjectRefs: jest.fn(
      async () => new Map([[P1, { id: P1, code: 'PRJ-001', name: 'Du an 1' }]]),
    ),
    findAreaRefs: jest.fn(
      async () => new Map([[AREA_ID, { id: AREA_ID, code: 'A-01', name: 'Khu A' }]]),
    ),
    findTradeRefs: jest.fn(
      async () => new Map([[TRADE_ID, { id: TRADE_ID, code: 'TR-01', name: 'Tho xay' }]]),
    ),
  };
  const scope = {
    resolveAccessibleProjectIds: jest.fn(async () => accessibleIds),
  };
  const useCase = new GetJobBoardFilterOptionsUseCase(repo as never, scope as never);
  return { useCase, findJobBoardFilterOptions, repo, scope };
}

describe('GetJobBoardFilterOptionsUseCase (JOB-SRS-006 #46, BD13)', () => {
  it('non-ADMIN: scope-first + enrich names, shape {id, name}', async () => {
    const { useCase, findJobBoardFilterOptions, repo } = setup([P1]);
    const out = await useCase.execute({ actorUserId: ACTOR, actorRoles: ['WORKER'] });
    expect(findJobBoardFilterOptions).toHaveBeenCalledWith(
      expect.objectContaining({ projectIds: [P1], now: expect.any(Date) }),
    );
    expect(out.projects).toEqual([{ id: P1, name: 'Du an 1' }]);
    expect(out.areas).toEqual([{ id: AREA_ID, name: 'Khu A' }]);
    expect(out.workTypes).toEqual([{ id: TYPE_ID, name: 'Do be tong' }]);
    expect(out.trades).toEqual([{ id: TRADE_ID, name: 'Tho xay' }]);
    expect(repo.findProjectRefs).toHaveBeenCalledWith([P1]);
  });

  it('ADMIN (null): unrestricted, không projectIds', async () => {
    const { useCase, findJobBoardFilterOptions } = setup(null);
    await useCase.execute({ actorUserId: ACTOR, actorRoles: ['ADMIN'] });
    expect(findJobBoardFilterOptions).toHaveBeenCalledWith(
      expect.objectContaining({ projectIds: undefined }),
    );
  });

  it('membership rỗng → 4 mảng rỗng, không query (BD2 parity, không 403)', async () => {
    const { useCase, findJobBoardFilterOptions, repo } = setup([]);
    const out = await useCase.execute({ actorUserId: ACTOR, actorRoles: ['WORKER'] });
    expect(out.projects).toEqual([]);
    expect(out.areas).toEqual([]);
    expect(out.workTypes).toEqual([]);
    expect(out.trades).toEqual([]);
    expect(findJobBoardFilterOptions).not.toHaveBeenCalled();
    expect(repo.findProjectRefs).not.toHaveBeenCalled();
  });

  it('id thiếu ref → fallback name = id (không vỡ)', async () => {
    const { useCase } = setup([P1]);
    useCase['workOrderRepo']['findTradeRefs'] = jest.fn(async () => new Map());
    const out = await useCase.execute({ actorUserId: ACTOR, actorRoles: ['WORKER'] });
    expect(out.trades).toEqual([{ id: TRADE_ID, name: TRADE_ID }]);
  });

  it('port thiếu findJobBoardFilterOptions → 500 fail-closed', async () => {
    const legacyRepo = {
      findWorkTypeRefs: jest.fn(async () => new Map()),
      findProjectRefs: jest.fn(async () => new Map()),
    };
    const scope = { resolveAccessibleProjectIds: jest.fn(async () => [P1]) };
    const useCase = new GetJobBoardFilterOptionsUseCase(legacyRepo as never, scope as never);
    await expect(
      useCase.execute({ actorUserId: ACTOR, actorRoles: ['WORKER'] }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
