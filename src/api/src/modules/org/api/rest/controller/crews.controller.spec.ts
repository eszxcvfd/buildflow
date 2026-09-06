import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { CrewsController } from './crews.controller';
import { CreateCrewUseCase } from '../../../application/use-case/create-crew.use-case';
import { UpdateCrewUseCase } from '../../../application/use-case/update-crew.use-case';
import { GetCrewUseCase } from '../../../application/use-case/get-crew.use-case';
import { SearchCrewsUseCase } from '../../../application/use-case/search-crews.use-case';
import { StatusTransitionCrewUseCase } from '../../../application/use-case/status-transition-crew.use-case';
import { GetCrewOpenWorkUseCase } from '../../../application/use-case/get-crew-open-work.use-case';
import { AddCrewMemberUseCase } from '../../../application/use-case/add-crew-member.use-case';
import { RemoveCrewMemberUseCase } from '../../../application/use-case/remove-crew-member.use-case';
import { ListCrewMembersUseCase } from '../../../application/use-case/list-crew-members.use-case';
import { CrewEntity } from '../../../domain/entity/crew.entity';
import { CrewMemberRow } from '../../../domain/repository/crew-repository.port';

const LEADER = '33333333-3333-4333-8333-333333333333';
const ACTOR = '22222222-2222-4222-8222-222222222222';

function makeCrew(id: string, status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE'): CrewEntity {
  return new CrewEntity({
    id,
    code: `CREW-${id.slice(0, 3)}`,
    name: `Đội ${id}`,
    status,
    leaderUserId: LEADER,
    createdBy: ACTOR,
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  });
}

function makeMember(id: string): CrewMemberRow {
  return {
    id,
    crewId: '11111111-1111-4111-8111-111111111111',
    userId: '33333333-3333-4333-8333-333333333333',
    memberRole: 'MEMBER',
    effectiveFrom: '2026-09-01',
    effectiveTo: null,
    isActive: true,
    addedBy: ACTOR,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    userName: 'Nguyen Van A',
    userCode: 'EMP-1',
  };
}

function adminReq(): unknown {
  return { user: { sub: 'admin-1', roles: ['ADMIN'] }, headers: { 'user-agent': 'jest' }, ip: '127.0.0.1' } as unknown;
}
function pmReq(): unknown {
  return { user: { sub: 'pm-1', roles: ['PROJECT_MANAGER'] }, headers: { 'user-agent': 'jest' }, ip: '127.0.0.1' } as unknown;
}
function workerReq(): unknown {
  return { user: { sub: 'user-1', roles: ['WORKER'] }, headers: {}, ip: '127.0.0.1' } as unknown;
}

const VALID_CORR = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';

function reqWithCorr(roles: string[], correlationId: string): unknown {
  return { user: { sub: 'u-1', roles }, headers: { 'user-agent': 'jest', 'x-correlation-id': correlationId }, ip: '127.0.0.1' } as unknown;
}

describe('CrewsController ORG-SRS-006 (issue #29)', () => {
  const CID = '11111111-1111-4111-8111-111111111111';
  let createMock: jest.Mocked<CreateCrewUseCase>;
  let updateMock: jest.Mocked<UpdateCrewUseCase>;
  let getMock: jest.Mocked<GetCrewUseCase>;
  let searchMock: jest.Mocked<SearchCrewsUseCase>;
  let transitionMock: jest.Mocked<StatusTransitionCrewUseCase>;
  let openWorkMock: jest.Mocked<GetCrewOpenWorkUseCase>;
  let addMemberMock: jest.Mocked<AddCrewMemberUseCase>;
  let removeMemberMock: jest.Mocked<RemoveCrewMemberUseCase>;
  let listMembersMock: jest.Mocked<ListCrewMembersUseCase>;
  let controller: CrewsController;

  beforeEach(() => {
    createMock = { execute: jest.fn(async () => ({ entity: makeCrew(CID) })) } as unknown as jest.Mocked<CreateCrewUseCase>;
    updateMock = { execute: jest.fn(async () => ({ entity: makeCrew(CID) })) } as unknown as jest.Mocked<UpdateCrewUseCase>;
    getMock = { execute: jest.fn(async () => ({ entity: makeCrew(CID) })) } as unknown as jest.Mocked<GetCrewUseCase>;
    searchMock = { execute: jest.fn(async () => ({ entities: [makeCrew(CID)], total: 1 })) } as unknown as jest.Mocked<SearchCrewsUseCase>;
    transitionMock = { execute: jest.fn(async () => ({ entity: makeCrew(CID), alreadyInState: false })) } as unknown as jest.Mocked<StatusTransitionCrewUseCase>;
    openWorkMock = { execute: jest.fn(async () => ({ openAssignments: 0 })) } as unknown as jest.Mocked<GetCrewOpenWorkUseCase>;
    addMemberMock = { execute: jest.fn(async () => ({ member: makeMember('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') })) } as unknown as jest.Mocked<AddCrewMemberUseCase>;
    removeMemberMock = { execute: jest.fn(async () => ({ member: makeMember('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), alreadyRemoved: false })) } as unknown as jest.Mocked<RemoveCrewMemberUseCase>;
    listMembersMock = { execute: jest.fn(async () => ({ members: [makeMember('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')] })) } as unknown as jest.Mocked<ListCrewMembersUseCase>;
    controller = new CrewsController(createMock, updateMock, getMock, searchMock, transitionMock, openWorkMock, addMemberMock, removeMemberMock, listMembersMock);
  });

  describe('role matrix: ADMIN + PROJECT_MANAGER read+write; WORKER 403', () => {
    it('ADMIN full access (create/search/detail/update/status/open-work)', async () => {
      await controller.create({ code: 'CREW-001', name: 'Đội A', leaderUserId: LEADER } as never, adminReq() as never);
      expect(createMock.execute).toHaveBeenCalledWith(expect.objectContaining({ code: 'CREW-001', actorUserId: 'admin-1' }));
      await controller.search(adminReq() as never, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
      await controller.getOne(CID, adminReq() as never);
      await controller.update(CID, { name: 'B' } as never, adminReq() as never);
      await controller.changeStatus(CID, { action: 'SUSPEND', reason: 'x' } as never, adminReq() as never);
      await controller.openWork(CID, adminReq() as never);
      expect(searchMock.execute).toHaveBeenCalled();
      expect(getMock.execute).toHaveBeenCalledWith({ crewId: CID });
      expect(updateMock.execute).toHaveBeenCalled();
      expect(transitionMock.execute).toHaveBeenCalled();
      expect(openWorkMock.execute).toHaveBeenCalledWith({ crewId: CID });
    });

    it('PROJECT_MANAGER read + write (khác write admin-only của workers/contractors)', async () => {
      const res = await controller.create({ code: 'CREW-001', name: 'Đội A', leaderUserId: LEADER } as never, pmReq() as never);
      expect(res.code).toBeDefined();
      await controller.update(CID, { name: 'B' } as never, pmReq() as never);
      await controller.changeStatus(CID, { action: 'ACTIVATE' } as never, pmReq() as never);
      await controller.openWork(CID, pmReq() as never);
      const one = await controller.getOne(CID, pmReq() as never);
      expect(one.id).toBe(CID);
      expect(one.leaderUserId).toBe(LEADER);
      expect(one.eligible).toBe(true);
    });

    it('WORKER-role mọi endpoint → 403, không gọi use case', async () => {
      await expect(controller.create({ code: 'C', name: 'N', leaderUserId: LEADER } as never, workerReq() as never)).rejects.toThrow(ForbiddenException);
      await expect(controller.search(workerReq() as never, undefined, undefined, undefined, undefined, undefined, undefined, undefined)).rejects.toThrow(ForbiddenException);
      await expect(controller.getOne(CID, workerReq() as never)).rejects.toThrow(ForbiddenException);
      await expect(controller.update(CID, { name: 'B' } as never, workerReq() as never)).rejects.toThrow(ForbiddenException);
      await expect(controller.changeStatus(CID, { action: 'SUSPEND', reason: 'x' } as never, workerReq() as never)).rejects.toThrow(ForbiddenException);
      await expect(controller.openWork(CID, workerReq() as never)).rejects.toThrow(ForbiddenException);
      await expect(controller.listMembers(CID, workerReq() as never)).rejects.toThrow(ForbiddenException);
      await expect(controller.addMember(CID, { userId: LEADER } as never, workerReq() as never)).rejects.toThrow(ForbiddenException);
      await expect(controller.removeMember(CID, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', workerReq() as never)).rejects.toThrow(ForbiddenException);
      expect(createMock.execute).not.toHaveBeenCalled();
      expect(searchMock.execute).not.toHaveBeenCalled();
      expect(getMock.execute).not.toHaveBeenCalled();
      expect(updateMock.execute).not.toHaveBeenCalled();
      expect(transitionMock.execute).not.toHaveBeenCalled();
      expect(openWorkMock.execute).not.toHaveBeenCalled();
      expect(addMemberMock.execute).not.toHaveBeenCalled();
      expect(removeMemberMock.execute).not.toHaveBeenCalled();
      expect(listMembersMock.execute).not.toHaveBeenCalled();
    });
  });

  it('GET search filter + sort/order + eligibleOnly; sai → 400 fieldErrors', async () => {
    const res = await controller.search(adminReq() as never, 'ACTIVE', 'alpha', 'true', 'name', 'asc', '10', '0');
    expect(searchMock.execute).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ACTIVE', search: 'alpha', eligibleOnly: true, sort: 'name', order: 'asc', limit: 10, offset: 0,
    }));
    expect(res.total).toBe(1);
    const badSort = await controller.search(adminReq() as never, undefined, undefined, undefined, 'nope', undefined, undefined, undefined).catch((e: unknown) => e);
    expect((badSort as BadRequestException).getResponse()).toEqual({
      statusCode: 400,
      message: 'Sort không hợp lệ (name|createdAt)',
      fieldErrors: { sort: ['Sort không hợp lệ (name|createdAt)'] },
    });
    await expect(controller.search(adminReq() as never, 'INACTIVE', undefined, 'true', undefined, undefined, undefined, undefined)).rejects.toThrow(BadRequestException);
  });

  it('không hard delete crew — DELETE duy nhất là members soft-deactivate (D2, giữ lịch sử)', () => {
    const proto = Object.getOwnPropertyNames(CrewsController.prototype);
    const destructive = proto.filter((m) => /delete|remove|destroy/i.test(m));
    expect(destructive).toEqual(['removeMember']);
  });

  describe('X-Correlation-Id strict trên create/update/status', () => {
    const createDto = { code: 'CREW-002', name: 'Đội B', leaderUserId: LEADER } as never;

    it('hợp lệ → forwarded; sai → 400 actionable, không gọi use case; thiếu → null', async () => {
      await controller.create(createDto, reqWithCorr(['ADMIN'], VALID_CORR) as never);
      expect(createMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: VALID_CORR }));
      createMock.execute.mockClear();
      await expect(controller.create(createDto, reqWithCorr(['ADMIN'], 'not-a-uuid') as never)).rejects.toThrow(
        new BadRequestException('X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)'),
      );
      expect(createMock.execute).not.toHaveBeenCalled();
      await controller.create(createDto, adminReq() as never);
      expect(createMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: null }));
    });

    it('update/status sai correlation → 400, không gọi use case', async () => {
      await expect(controller.update(CID, { name: 'B' } as never, reqWithCorr(['PROJECT_MANAGER'], 'bad') as never)).rejects.toThrow(BadRequestException);
      expect(updateMock.execute).not.toHaveBeenCalled();
      await expect(controller.changeStatus(CID, { action: 'SUSPEND', reason: 'x' } as never, reqWithCorr(['ADMIN'], 'bad') as never)).rejects.toThrow(BadRequestException);
      expect(transitionMock.execute).not.toHaveBeenCalled();
    });
  });

  describe('lifecycle + open-work', () => {
    it('changeStatus forward action/reason/metadata, kèm alreadyInState + warning', async () => {
      const res = await controller.changeStatus(CID, { action: 'SUSPEND', reason: 'Vi phạm' } as never, reqWithCorr(['ADMIN'], VALID_CORR) as never);
      expect(transitionMock.execute).toHaveBeenCalledWith(expect.objectContaining({
        crewId: CID, action: 'SUSPEND', reason: 'Vi phạm', actorUserId: 'u-1', correlationId: VALID_CORR,
      }));
      expect(res.alreadyInState).toBe(false);
      transitionMock.execute.mockResolvedValue({ entity: makeCrew(CID, 'INACTIVE'), alreadyInState: false, warning: { openAssignments: 2 } });
      const res2 = await controller.changeStatus(CID, { action: 'TERMINATE', reason: 'x' } as never, adminReq() as never);
      expect(res2.warning).toEqual({ openAssignments: 2 });
      expect(res2.status).toBe('INACTIVE');
      expect(res2.eligible).toBe(false);
    });

    it('open-work trả {openAssignments}', async () => {
      openWorkMock.execute.mockResolvedValue({ openAssignments: 5 });
      const res = await controller.openWork(CID, pmReq() as never);
      expect(res.openAssignments).toBe(5);
    });
  });

  describe('members ORG-SRS-007 (issue #30)', () => {
    const MID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    it('ADMIN + PM read + write members; response member shape', async () => {
      const list = await controller.listMembers(CID, pmReq() as never, undefined, undefined);
      expect(listMembersMock.execute).toHaveBeenCalledWith({ crewId: CID, at: undefined, includeInactive: false });
      expect(list.total).toBe(1);
      expect(list.data[0]).toEqual(expect.objectContaining({
        id: MID, memberRole: 'MEMBER', effectiveFrom: '2026-09-01', isActive: true, userName: 'Nguyen Van A',
      }));
      const added = await controller.addMember(CID, { userId: LEADER, effectiveFrom: '2026-09-01' } as never, adminReq() as never);
      expect(addMemberMock.execute).toHaveBeenCalledWith(expect.objectContaining({
        crewId: CID, userId: LEADER, effectiveFrom: '2026-09-01', actorUserId: 'admin-1',
      }));
      expect(added.memberRole).toBe('MEMBER');
      expect((added as Record<string, unknown>).warning).toBeUndefined();
      const removed = await controller.removeMember(CID, MID, adminReq() as never, { effectiveTo: '2026-09-06', reason: 'x' } as never);
      expect(removeMemberMock.execute).toHaveBeenCalledWith(expect.objectContaining({
        crewId: CID, memberId: MID, effectiveTo: '2026-09-06', reason: 'x',
      }));
      expect(removed.alreadyRemoved).toBe(false);
    });

    it('list forward at + includeInactive; add kèm warning; remove alreadyRemoved', async () => {
      await controller.listMembers(CID, adminReq() as never, '2026-09-03', 'true');
      expect(listMembersMock.execute).toHaveBeenCalledWith({ crewId: CID, at: '2026-09-03', includeInactive: true });
      addMemberMock.execute.mockResolvedValue({
        member: makeMember(MID),
        warning: { code: 'MEMBER_IN_OTHER_CREW', otherCrews: [{ crewId: CID, crewCode: 'CREW-B', crewName: 'B' }] },
      });
      const warned = await controller.addMember(CID, { userId: LEADER } as never, pmReq() as never);
      expect((warned as Record<string, unknown>).warning).toEqual(expect.objectContaining({ code: 'MEMBER_IN_OTHER_CREW' }));
      removeMemberMock.execute.mockResolvedValue({ member: makeMember(MID), alreadyRemoved: true });
      const again = await controller.removeMember(CID, MID, adminReq() as never);
      expect(again.alreadyRemoved).toBe(true);
    });

    it('X-Correlation-Id strict trên add/remove members', async () => {
      await controller.addMember(CID, { userId: LEADER } as never, reqWithCorr(['ADMIN'], VALID_CORR) as never);
      expect(addMemberMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: VALID_CORR }));
      addMemberMock.execute.mockClear();
      await expect(controller.addMember(CID, { userId: LEADER } as never, reqWithCorr(['ADMIN'], 'bad') as never)).rejects.toThrow(BadRequestException);
      expect(addMemberMock.execute).not.toHaveBeenCalled();
      await expect(controller.removeMember(CID, MID, reqWithCorr(['PROJECT_MANAGER'], 'bad') as never)).rejects.toThrow(BadRequestException);
      expect(removeMemberMock.execute).not.toHaveBeenCalled();
    });
  });
});
