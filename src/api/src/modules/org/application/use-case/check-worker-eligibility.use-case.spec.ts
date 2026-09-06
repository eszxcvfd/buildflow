import { NotFoundException } from '@nestjs/common';
import {
  CheckWorkerEligibilityUseCase,
  normalizeCorrelationId,
} from './check-worker-eligibility.use-case';
import { WorkerRepositoryPort } from '../../domain/repository/worker-repository.port';
import { CrewRepositoryPort } from '../../domain/repository/crew-repository.port';
import { TradeRepositoryPort } from '../../domain/repository/trade-repository.port';
import { WorkerEntity } from '../../domain/entity/worker.entity';
import { UserEntity } from '../../../iam/domain/entity/user.entity';

const WID = '11111111-1111-4111-8111-111111111111';
const TRADE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const VALID_CORR = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';

function makeWorker(status: 'ACTIVE' | 'INACTIVE' | 'LOCKED' = 'ACTIVE', trades = true): WorkerEntity {
  const user = new UserEntity({
    id: WID,
    email: 'w@example.com',
    passwordHash: '$hash',
    fullName: 'Worker One',
    phone: null,
    avatarUrl: null,
    employeeCode: 'EMP-001',
    userType: 'WORKER',
    contractorId: null,
    status,
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  });
  return new WorkerEntity({
    user,
    trades: trades
      ? [{ tradeId: TRADE, skillLevel: 3, effectiveFrom: new Date('2026-09-01'), effectiveTo: null, isActive: true }]
      : [],
  });
}

function membership(at: string) {
  return {
    crewId: '22222222-2222-4222-8222-222222222222',
    crewCode: 'CREW-A',
    crewName: 'Đội A',
    memberRole: 'MEMBER' as const,
    effectiveFrom: '2026-09-01',
    effectiveTo: null,
    // marker chỉ để phân biệt row trong test filter — không thuộc port shape
    _at: at,
  };
}

describe('CheckWorkerEligibilityUseCase ORG-SRS-008 (issue #31)', () => {
  let workerRepo: jest.Mocked<WorkerRepositoryPort>;
  let crewRepo: jest.Mocked<CrewRepositoryPort>;
  let tradeRepo: jest.Mocked<TradeRepositoryPort>;
  let useCase: CheckWorkerEligibilityUseCase;

  beforeEach(() => {
    workerRepo = {
      findById: jest.fn(async () => makeWorker()),
      countOpenAssignments: jest.fn(async () => 0),
    } as unknown as jest.Mocked<WorkerRepositoryPort>;
    crewRepo = {
      findActiveMembershipsByUserId: jest.fn(async () => []),
    } as unknown as jest.Mocked<CrewRepositoryPort>;
    tradeRepo = {
      findById: jest.fn(async () => null),
    } as unknown as jest.Mocked<TradeRepositoryPort>;
    useCase = new CheckWorkerEligibilityUseCase(workerRepo, crewRepo, tradeRepo);
  });

  it('worker chuẩn → eligible=true, đủ 5 conditions + crews rỗng', async () => {
    const out = await useCase.execute({ workerId: WID, at: '2026-09-06', correlationId: VALID_CORR });
    expect(out.resourceType).toBe('WORKER');
    expect(out.resourceId).toBe(WID);
    expect(out.eligible).toBe(true);
    expect(out.conditions).toHaveLength(5);
    expect(out.correlationId).toBe(VALID_CORR);
    expect(out.crews).toEqual([]);
    expect(new Date(out.checkedAt).toString()).not.toBe('Invalid Date');
  });

  it('correlationId: reuse khi hợp lệ, generate uuid khi sai/thiếu', async () => {
    expect(normalizeCorrelationId(VALID_CORR)).toBe(VALID_CORR);
    const generated = normalizeCorrelationId('not-a-uuid');
    expect(generated).toMatch(/^[0-9a-f-]{36}$/i);
    expect(generated).not.toBe('not-a-uuid');
    expect(normalizeCorrelationId(null)).toMatch(/^[0-9a-f-]{36}$/i);
    const out = await useCase.execute({ workerId: WID, correlationId: 'bad' });
    expect(out.correlationId).not.toBe('bad');
  });

  it('worker không tồn tại → 404 RESOURCE_NOT_FOUND, không gọi count/memberships', async () => {
    workerRepo.findById.mockResolvedValue(null);
    const err = await useCase.execute({ workerId: WID }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotFoundException);
    expect((err as NotFoundException).getResponse()).toEqual(expect.objectContaining({
      statusCode: 404,
      code: 'RESOURCE_NOT_FOUND',
    }));
    expect(workerRepo.countOpenAssignments).not.toHaveBeenCalled();
    expect(crewRepo.findActiveMembershipsByUserId).not.toHaveBeenCalled();
  });

  it('/me resolution: notFoundMessage tùy biến khi user không có hồ sơ worker', async () => {
    workerRepo.findById.mockResolvedValue(null);
    const err = await useCase
      .execute({ workerId: 'jwt-sub', notFoundMessage: 'user không có hồ sơ worker' })
      .catch((e: unknown) => e);
    expect((err as NotFoundException).getResponse()).toEqual(expect.objectContaining({
      statusCode: 404,
      message: 'user không có hồ sơ worker',
      code: 'RESOURCE_NOT_FOUND',
    }));
  });

  it('worker 0 trade → eligible=false (fail closed: CAPABILITY_DATA_MISSING)', async () => {
    workerRepo.findById.mockResolvedValue(makeWorker('ACTIVE', false));
    const out = await useCase.execute({ workerId: WID });
    expect(out.eligible).toBe(false);
    expect(out.conditions.find((c) => c.code === 'TRADE_CAPABILITY_DATA')).toEqual(
      expect.objectContaining({ passed: false, reasonCode: 'CAPABILITY_DATA_MISSING' }),
    );
  });

  it('worker INACTIVE → eligible=false (RESOURCE_INACTIVE)', async () => {
    workerRepo.findById.mockResolvedValue(makeWorker('INACTIVE'));
    const out = await useCase.execute({ workerId: WID });
    expect(out.eligible).toBe(false);
    expect(out.conditions.find((c) => c.code === 'RESOURCE_ACTIVE')).toEqual(
      expect.objectContaining({ passed: false, reasonCode: 'RESOURCE_INACTIVE' }),
    );
  });

  it('tradeId yêu cầu: tồn tại + khớp → true; không tồn tại → TRADE_NOT_FOUND', async () => {
    tradeRepo.findById.mockResolvedValue({} as never);
    const ok = await useCase.execute({ workerId: WID, tradeId: TRADE });
    expect(ok.conditions.find((c) => c.code === 'TRADE_SKILL_MATCH')).toEqual(
      expect.objectContaining({ passed: true }),
    );
    expect(tradeRepo.findById).toHaveBeenCalledWith(TRADE);

    tradeRepo.findById.mockResolvedValue(null);
    const missing = await useCase.execute({
      workerId: WID,
      tradeId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    expect(missing.eligible).toBe(false);
    expect(missing.conditions.find((c) => c.code === 'TRADE_SKILL_MATCH')).toEqual(
      expect.objectContaining({ passed: false, reasonCode: 'TRADE_NOT_FOUND' }),
    );
  });

  it('skillLevel vượt cấp → SKILL_LEVEL_TOO_LOW, eligible=false', async () => {
    const out = await useCase.execute({ workerId: WID, skillLevel: 5 });
    expect(out.eligible).toBe(false);
    expect(out.conditions.find((c) => c.code === 'TRADE_SKILL_MATCH')).toEqual(
      expect.objectContaining({ passed: false, reasonCode: 'SKILL_LEVEL_TOO_LOW' }),
    );
  });

  it('không tradeId/skillLevel → không tra catalog trade', async () => {
    await useCase.execute({ workerId: WID });
    expect(tradeRepo.findById).not.toHaveBeenCalled();
  });

  it('crews[] lọc point-in-time theo at (inclusive hai đầu)', async () => {
    const rows = [
      { ...membership('x'), effectiveFrom: '2026-09-01', effectiveTo: null },
      { ...membership('x'), crewId: '33333333-3333-4333-8333-333333333333', crewCode: 'CREW-B', effectiveFrom: '2026-09-01', effectiveTo: '2026-09-05' },
      { ...membership('x'), crewId: '44444444-4444-4333-8333-444444444444', crewCode: 'CREW-C', effectiveFrom: '2026-09-10', effectiveTo: null },
    ];
    crewRepo.findActiveMembershipsByUserId.mockResolvedValue(rows);
    const out = await useCase.execute({ workerId: WID, at: '2026-09-05' });
    expect(out.crews.map((c) => c.crewCode).sort()).toEqual(['CREW-A', 'CREW-B']);
    const out2 = await useCase.execute({ workerId: WID, at: '2026-09-06' });
    expect(out2.crews.map((c) => c.crewCode)).toEqual(['CREW-A']);
  });

  it('WORKLOAD phản ánh count; read-only (không gọi save/audit/tx)', async () => {
    workerRepo.countOpenAssignments.mockResolvedValue(3);
    const out = await useCase.execute({ workerId: WID });
    const workload = out.conditions.find((c) => c.code === 'WORKLOAD')!;
    expect(workload.passed).toBe(true);
    expect(workload.detail).toContain('3');
    expect(out.eligible).toBe(true);
    expect(workerRepo.save).toBeUndefined();
  });
});
