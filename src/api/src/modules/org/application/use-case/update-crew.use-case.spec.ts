import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpdateCrewUseCase } from './update-crew.use-case';
import { CrewRepositoryPort } from '../../domain/repository/crew-repository.port';
import { ContractorRepositoryPort } from '../../domain/repository/contractor-repository.port';
import { UserRepositoryPort } from '../../../iam/domain/repository/user-repository.port';
import { AuditPort } from '../../../iam/application/port/audit.port';
import { TransactionPort } from '../../../iam/application/port/transaction.port';
import { CrewEntity } from '../../domain/entity/crew.entity';

const CREW_ID = '11111111-1111-4111-8111-111111111111';
const OLD_LEAD = '33333333-3333-4333-8333-333333333333';
const NEW_LEAD = '44444444-4444-4444-8444-444444444444';
const ACTOR = '22222222-2222-4222-8222-222222222222';

function makeCrew(leaderUserId: string | null = OLD_LEAD): CrewEntity {
  return new CrewEntity({
    id: CREW_ID,
    code: 'CREW-001',
    name: 'Đội Alpha',
    status: 'ACTIVE',
    leaderUserId,
    createdBy: ACTOR,
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  });
}

describe('UpdateCrewUseCase ORG-SRS-006 (issue #29)', () => {
  let crewRepo: jest.Mocked<CrewRepositoryPort>;
  let contractorRepo: jest.Mocked<ContractorRepositoryPort>;
  let userRepo: jest.Mocked<UserRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let tx: jest.Mocked<TransactionPort>;
  let useCase: UpdateCrewUseCase;

  beforeEach(() => {
    crewRepo = {
      findById: jest.fn(async () => makeCrew()),
      findByCode: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      saveWithClient: jest.fn(async () => {}),
      insertLeadWithClient: jest.fn(async () => {}),
      deactivateActiveLeadWithClient: jest.fn(async () => {}),
      countOpenAssignments: jest.fn(async () => 0),
    } as unknown as jest.Mocked<CrewRepositoryPort>;
    contractorRepo = {
      findById: jest.fn(async () => ({ id: 'x' } as never)),
      findByCode: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      countOpenAssignments: jest.fn(async () => 0),
    } as unknown as jest.Mocked<ContractorRepositoryPort>;
    userRepo = {
      findById: jest.fn(async () => ({ userType: 'WORKER', status: 'ACTIVE' } as never)),
    } as unknown as jest.Mocked<UserRepositoryPort>;
    audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    tx = { withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({} as never)) } as unknown as jest.Mocked<TransactionPort>;
    useCase = new UpdateCrewUseCase(crewRepo, contractorRepo, userRepo, audit, tx);
  });

  it('rename: audit ORG_CREW_UPDATED, không đụng LEAD', async () => {
    const out = await useCase.execute({ crewId: CREW_ID, name: 'Đội Beta', actorUserId: ACTOR });
    expect(out.entity.name).toBe('Đội Beta');
    expect(crewRepo.deactivateActiveLeadWithClient).not.toHaveBeenCalled();
    expect(crewRepo.insertLeadWithClient).not.toHaveBeenCalled();
    expect(audit.logWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'ORG_CREW_UPDATED', entityType: 'CREW' }),
    );
  });

  it('leader swap: LEAD cũ deactivate + mới insert + audit ORG_CREW_LEAD_CHANGED (leader cũ/mới)', async () => {
    const out = await useCase.execute({ crewId: CREW_ID, leaderUserId: NEW_LEAD, actorUserId: ACTOR });
    expect(out.entity.leaderUserId).toBe(NEW_LEAD);
    expect(crewRepo.deactivateActiveLeadWithClient).toHaveBeenCalledWith(expect.anything(), CREW_ID);
    expect(crewRepo.insertLeadWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ crewId: CREW_ID, userId: NEW_LEAD, addedBy: ACTOR }),
    );
    const call = (audit.logWithClient as jest.Mock).mock.calls[0][1] as {
      action: string; beforeData: { leaderUserId: string }; afterData: { leaderUserId: string };
    };
    expect(call.action).toBe('ORG_CREW_LEAD_CHANGED');
    expect(call.beforeData.leaderUserId).toBe(OLD_LEAD);
    expect(call.afterData.leaderUserId).toBe(NEW_LEAD);
  });

  it('same leader → no-op, không audit lead', async () => {
    await useCase.execute({ crewId: CREW_ID, leaderUserId: OLD_LEAD, actorUserId: ACTOR });
    expect(crewRepo.deactivateActiveLeadWithClient).not.toHaveBeenCalled();
    expect(crewRepo.insertLeadWithClient).not.toHaveBeenCalled();
    expect(audit.logWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'ORG_CREW_UPDATED' }),
    );
    expect(audit.logWithClient).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'ORG_CREW_LEAD_CHANGED' }),
    );
  });

  it('leader mới invalid (STAFF/inactive/format) → 400 fieldErrors, không save/audit', async () => {
    userRepo.findById.mockResolvedValue({ userType: 'STAFF', status: 'ACTIVE' } as never);
    await expect(useCase.execute({ crewId: CREW_ID, leaderUserId: NEW_LEAD, actorUserId: ACTOR })).rejects.toThrow(BadRequestException);
    await expect(useCase.execute({ crewId: CREW_ID, leaderUserId: 'bad', actorUserId: ACTOR })).rejects.toThrow(BadRequestException);
    expect(crewRepo.saveWithClient).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('race LEAD (ux_crew_one_active_lead) → 409', async () => {
    (crewRepo.insertLeadWithClient as jest.Mock).mockRejectedValue(
      Object.assign(new Error('dup lead'), { code: '23505', constraint: 'ux_crew_one_active_lead' }),
    );
    await expect(useCase.execute({ crewId: CREW_ID, leaderUserId: NEW_LEAD, actorUserId: ACTOR })).rejects.toThrow(
      'Đội đã có trưởng nhóm đang hiệu lực',
    );
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('P2-1 (review #29): deactivate LEAD lỗi DB lạ → reject lỗi gốc, KHÔNG phải 400', async () => {
    const dbErr = new Error('connection terminated');
    (crewRepo.deactivateActiveLeadWithClient as jest.Mock).mockRejectedValue(dbErr);
    const err = await useCase
      .execute({ crewId: CREW_ID, leaderUserId: NEW_LEAD, actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect(err).toBe(dbErr);
    expect(err).not.toBeInstanceOf(BadRequestException);
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('P2-1 (review #29): validation updateDetails lỗi vẫn 400, không chạm DB', async () => {
    await expect(
      useCase.execute({ crewId: CREW_ID, name: 'X', actorUserId: ACTOR }),
    ).rejects.toThrow(BadRequestException);
    expect(crewRepo.deactivateActiveLeadWithClient).not.toHaveBeenCalled();
    expect(crewRepo.saveWithClient).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('không tìm thấy đội → 404', async () => {
    crewRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ crewId: CREW_ID, name: 'X', actorUserId: ACTOR })).rejects.toThrow(NotFoundException);
  });

  it('contractor không tồn tại → 400 fieldErrors, không save', async () => {
    contractorRepo.findById.mockResolvedValue(null);
    const err = await useCase
      .execute({ crewId: CREW_ID, contractorId: '99999999-9999-4999-8999-999999999999', actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect((err as BadRequestException).getResponse()).toEqual({
      statusCode: 400,
      message: 'Nhà thầu không tồn tại',
      fieldErrors: { contractorId: ['Nhà thầu không tồn tại'] },
    });
    expect(crewRepo.saveWithClient).not.toHaveBeenCalled();
  });
});
