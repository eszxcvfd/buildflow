import { ForbiddenException } from '@nestjs/common';
import { SearchWorkOrdersUseCase } from './search-work-orders.use-case';
import { WorkOrderEntity } from '../../domain/entity/work-order.entity';

const P1 = '22222222-2222-4222-8222-222222222222';
const P2 = '99999999-9999-4999-8999-999999999999';
const TYPE_ID = '44444444-4444-4444-8444-444444444444';
const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function makeEntity(id: string, projectId: string, status: 'DRAFT' | 'OPEN' = 'DRAFT'): WorkOrderEntity {
  return new WorkOrderEntity({
    id,
    code: `WO-${id.slice(0, 4).toUpperCase()}`,
    projectId,
    areaId: null,
    workTypeId: TYPE_ID,
    requiredTradeId: null,
    title: `Viec ${id.slice(0, 4)}`,
    description: null,
    instructions: null,
    priority: 'NORMAL',
    status,
    plannedStartAt: null,
    plannedEndAt: null,
    dueAt: null,
    plannedHeadcount: null,
    customFields: {},
    createdBy: ACTOR,
    version: 1,
    requestKey: null,
    jobBoardOpen: false,
    jobBoardOpenFrom: null,
    jobBoardOpenUntil: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

function setup(accessibleIds: string[] | null) {
  const e1 = makeEntity('11111111-1111-4111-8111-111111111111', P1);
  const e2 = makeEntity('33333333-3333-4333-8333-333333333333', P2, 'OPEN');
  const search = jest.fn(async () => ({ entities: [e1], total: 1 }));
  const repo = {
    search,
    findWorkTypeRefs: jest.fn(async () => new Map([[TYPE_ID, { id: TYPE_ID, code: 'WT-001', name: 'Do be tong' }]])),
    findProjectRefs: jest.fn(async () => new Map([[P1, { id: P1, code: 'PRJ-001', name: 'Du an 1' }]])),
  };
  const scope = {
    resolveAccessibleProjectIds: jest.fn(async () => accessibleIds),
  };
  const useCase = new SearchWorkOrdersUseCase(repo as never, scope as never);
  return { useCase, search, repo, scope, e1 };
}

describe('SearchWorkOrdersUseCase (list scope)', () => {
  it('ADMIN (null = unrestricted): search không projectIds, kèm refs batch', async () => {
    const { useCase, search, repo } = setup(null);
    const out = await useCase.execute({ actorUserId: ACTOR, actorRoles: ['ADMIN'] });
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ALL', projectIds: undefined, projectId: undefined }),
    );
    expect(out.total).toBe(1);
    expect(out.workTypeRefs.get(TYPE_ID)?.name).toBe('Do be tong');
    expect(out.projectRefs.get(P1)?.name).toBe('Du an 1');
    expect(repo.findWorkTypeRefs).toHaveBeenCalledWith([TYPE_ID]);
    expect(repo.findProjectRefs).toHaveBeenCalledWith([P1]);
  });

  it('non-ADMIN: scope projectIds = membership, forward filter status/search/pagination', async () => {
    const { useCase, search } = setup([P1]);
    await useCase.execute({
      actorUserId: ACTOR,
      actorRoles: ['WORKER'],
      status: 'DRAFT',
      search: 'be tong',
      limit: 20,
      offset: 0,
    });
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'DRAFT',
        projectIds: [P1],
        search: 'be tong',
        limit: 20,
        offset: 0,
      }),
    );
  });

  it('non-ADMIN membership rỗng → [] total 0, không query repo', async () => {
    const { useCase, search, repo } = setup([]);
    const out = await useCase.execute({ actorUserId: ACTOR, actorRoles: ['WORKER'] });
    expect(out).toEqual({ entities: [], total: 0, workTypeRefs: new Map(), projectRefs: new Map() });
    expect(search).not.toHaveBeenCalled();
    expect(repo.findWorkTypeRefs).not.toHaveBeenCalled();
  });

  it('non-ADMIN projectId trong scope → lọc project đó', async () => {
    const { useCase, search } = setup([P1, P2]);
    await useCase.execute({ actorUserId: ACTOR, actorRoles: ['WORKER'], projectId: P1 });
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ projectId: P1, projectIds: [P1, P2] }));
  });

  it('non-ADMIN projectId ngoài scope → 403 generic (anti-leak)', async () => {
    const { useCase, search } = setup([P1]);
    await expect(
      useCase.execute({ actorUserId: ACTOR, actorRoles: ['WORKER'], projectId: P2 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(search).not.toHaveBeenCalled();
  });

  it('ADMIN + projectId: lọc project đó, không 403', async () => {
    const { useCase, search } = setup(null);
    await useCase.execute({ actorUserId: ACTOR, actorRoles: ['ADMIN'], projectId: P2 });
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ projectId: P2, projectIds: undefined }));
  });
});
