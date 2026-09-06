import { ConflictException, BadRequestException } from '@nestjs/common';
import { CreateCrewUseCase } from './create-crew.use-case';
import { CrewRepositoryPort } from '../../domain/repository/crew-repository.port';
import { ContractorRepositoryPort } from '../../domain/repository/contractor-repository.port';
import { UserRepositoryPort } from '../../../iam/domain/repository/user-repository.port';
import { AuditPort } from '../../../iam/application/port/audit.port';
import { TransactionPort } from '../../../iam/application/port/transaction.port';

const LEADER_ID = '33333333-3333-4333-8333-333333333333';
const ACTOR = '22222222-2222-4222-8222-222222222222';

function workerUser(status = 'ACTIVE', userType = 'WORKER'): unknown {
  return { userType, status };
}

describe('CreateCrewUseCase ORG-SRS-006 (issue #29)', () => {
  let crewRepo: jest.Mocked<CrewRepositoryPort>;
  let contractorRepo: jest.Mocked<ContractorRepositoryPort>;
  let userRepo: jest.Mocked<UserRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let tx: jest.Mocked<TransactionPort>;
  let useCase: CreateCrewUseCase;

  beforeEach(() => {
    crewRepo = {
      findById: jest.fn(),
      findByCode: jest.fn(async () => null),
      findMany: jest.fn(),
      create: jest.fn(),
      createWithClient: jest.fn(async () => {}),
      save: jest.fn(),
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
      findById: jest.fn(async () => workerUser() as never),
    } as unknown as jest.Mocked<UserRepositoryPort>;
    audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    tx = { withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({} as never)) } as unknown as jest.Mocked<TransactionPort>;
    useCase = new CreateCrewUseCase(crewRepo, contractorRepo, userRepo, audit, tx);
  });

  it('tạo đội hợp lệ: crew + LEAD cùng tx, audit ORG_CREW_CREATED', async () => {
    const out = await useCase.execute({ code: 'CREW-001', name: 'Đội Alpha', leaderUserId: LEADER_ID, actorUserId: ACTOR });
    expect(out.entity.code).toBe('CREW-001');
    expect(out.entity.leaderUserId).toBe(LEADER_ID);
    expect(crewRepo.createWithClient).toHaveBeenCalledTimes(1);
    expect(crewRepo.insertLeadWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: LEADER_ID, addedBy: ACTOR }),
    );
    expect(audit.logWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'ORG_CREW_CREATED', entityType: 'CREW' }),
    );
  });

  it('trùng mã: pre-check 409 + race 23505/ux_crews_code → 409', async () => {
    crewRepo.findByCode.mockResolvedValue({ id: 'other' } as never);
    await expect(useCase.execute({ code: 'CREW-001', name: 'Alpha', leaderUserId: LEADER_ID, actorUserId: ACTOR })).rejects.toThrow(ConflictException);

    crewRepo.findByCode.mockResolvedValue(null);
    crewRepo.createWithClient = jest.fn(async () => {
      throw Object.assign(new Error('dup'), { code: '23505', constraint: 'ux_crews_code' });
    });
    await expect(useCase.execute({ code: 'CREW-002', name: 'Alpha', leaderUserId: LEADER_ID, actorUserId: ACTOR })).rejects.toThrow('Mã đội đã tồn tại');
  });

  it('race LEAD (ux_crew_one_active_lead) → 409 trưởng nhóm đang hiệu lực', async () => {
    (crewRepo.insertLeadWithClient as jest.Mock).mockRejectedValue(
      Object.assign(new Error('dup lead'), { code: '23505', constraint: 'ux_crew_one_active_lead' }),
    );
    await expect(useCase.execute({ code: 'CREW-003', name: 'Alpha', leaderUserId: LEADER_ID, actorUserId: ACTOR })).rejects.toThrow(
      'Đội đã có trưởng nhóm đang hiệu lực',
    );
  });

  it('leader invalid → 400 fieldErrors {leaderUserId}', async () => {
    // user không tồn tại
    userRepo.findById.mockResolvedValue(null);
    const err = await useCase.execute({ code: 'CREW-004', name: 'Đội X', leaderUserId: LEADER_ID, actorUserId: ACTOR } as never).catch((e: unknown) => e);
    expect((err as BadRequestException).getResponse()).toEqual({
      statusCode: 400,
      message: 'Trưởng nhóm phải là worker đang hoạt động',
      fieldErrors: { leaderUserId: ['Trưởng nhóm phải là worker đang hoạt động'] },
    });
    // STAFF không làm lead
    userRepo.findById.mockResolvedValue(workerUser('ACTIVE', 'STAFF') as never);
    await expect(useCase.execute({ code: 'CREW-004', name: 'Đội A', leaderUserId: LEADER_ID, actorUserId: ACTOR })).rejects.toThrow(BadRequestException);
    // worker INACTIVE không làm lead
    userRepo.findById.mockResolvedValue(workerUser('INACTIVE', 'WORKER') as never);
    await expect(useCase.execute({ code: 'CREW-004', name: 'Đội A', leaderUserId: LEADER_ID, actorUserId: ACTOR })).rejects.toThrow(BadRequestException);
    // format sai
    await expect(useCase.execute({ code: 'CREW-004', name: 'Đội A', leaderUserId: 'bad', actorUserId: ACTOR })).rejects.toThrow(BadRequestException);
    expect(crewRepo.createWithClient).not.toHaveBeenCalled();
    expect(err).toBeDefined();
  });

  it('contractor không tồn tại → 400 fieldErrors {contractorId}', async () => {
    contractorRepo.findById.mockResolvedValue(null);
    const err = await useCase
      .execute({ code: 'CREW-005', name: 'Đội A', leaderUserId: LEADER_ID, contractorId: '99999999-9999-4999-8999-999999999999', actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect((err as BadRequestException).getResponse()).toEqual({
      statusCode: 400,
      message: 'Nhà thầu không tồn tại',
      fieldErrors: { contractorId: ['Nhà thầu không tồn tại'] },
    });
  });

  it('retry/double-submit: audit đúng 1 lần mỗi success (tx-embedded)', async () => {
    await useCase.execute({ code: 'CREW-006', name: 'Đội Beta', leaderUserId: LEADER_ID, actorUserId: ACTOR });
    expect(crewRepo.createWithClient).toHaveBeenCalledTimes(1);
    expect(audit.logWithClient).toHaveBeenCalledTimes(1);
  });

  it('correlationId đi vào audit payload ORG_CREW_CREATED', async () => {
    const corr = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';
    await useCase.execute({ code: 'CREW-007', name: 'Đội C', leaderUserId: LEADER_ID, actorUserId: ACTOR, correlationId: corr });
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_CREW_CREATED', correlationId: corr }));
  });
});
