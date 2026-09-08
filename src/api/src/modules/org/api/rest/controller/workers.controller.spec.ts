import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { WorkersController } from './workers.controller';
import { CreateWorkerUseCase } from '../../../application/use-case/create-worker.use-case';
import { UpdateWorkerUseCase } from '../../../application/use-case/update-worker.use-case';
import { GetWorkerUseCase } from '../../../application/use-case/get-worker.use-case';
import { SearchWorkersUseCase } from '../../../application/use-case/search-workers.use-case';
import { StatusTransitionWorkerUseCase } from '../../../application/use-case/status-transition-worker.use-case';
import { GetWorkerOpenWorkUseCase } from '../../../application/use-case/get-worker-open-work.use-case';
import { GetWorkerCrewsUseCase } from '../../../application/use-case/get-worker-crews.use-case';
import { WorkerEntity } from '../../../domain/entity/worker.entity';
import { UserEntity } from '../../../../iam/domain/entity/user.entity';

function makeWorker(id: string, status: string = 'ACTIVE'): WorkerEntity {
  const user = new UserEntity({
    id,
    email: `${id}@example.com`,
    passwordHash: '$hash',
    fullName: `Worker ${id}`,
    phone: null,
    avatarUrl: null,
    employeeCode: `EMP-${id}`,
    userType: 'WORKER',
    contractorId: null,
    status: status as never,
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  });
  return new WorkerEntity({ user, trades: [{ tradeId: '11111111-1111-4111-8111-111111111111', skillLevel: 3, effectiveFrom: new Date(), isActive: true }] });
}

function adminReq(): unknown {
  return { user: { sub: 'admin-1', roles: ['ADMIN'] }, headers: { 'user-agent': 'jest' }, ip: '127.0.0.1' } as unknown;
}

const VALID_CORR = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';

function adminReqWithCorr(correlationId: string): unknown {
  return { user: { sub: 'admin-1', roles: ['ADMIN'] }, headers: { 'user-agent': 'jest', 'x-correlation-id': correlationId }, ip: '127.0.0.1' } as unknown;
}

function workerReq(): unknown {
  return { user: { sub: 'user-1', roles: ['WORKER'] }, headers: {}, ip: '127.0.0.1' } as unknown;
}

function pmReq(): unknown {
  return { user: { sub: 'pm-1', roles: ['PROJECT_MANAGER'] }, headers: { 'user-agent': 'jest' }, ip: '127.0.0.1' } as unknown;
}

describe('WorkersController ORG-SRS-001', () => {
  let createMock: jest.Mocked<CreateWorkerUseCase>;
  let updateMock: jest.Mocked<UpdateWorkerUseCase>;
  let getMock: jest.Mocked<GetWorkerUseCase>;
  let searchMock: jest.Mocked<SearchWorkersUseCase>;
  let transitionMock: jest.Mocked<StatusTransitionWorkerUseCase>;
  let openWorkMock: jest.Mocked<GetWorkerOpenWorkUseCase>;
  let crewsMock: jest.Mocked<GetWorkerCrewsUseCase>;
  let controller: WorkersController;

  beforeEach(() => {
    createMock = { execute: jest.fn(async () => ({ entity: makeWorker('w1') })) } as unknown as jest.Mocked<CreateWorkerUseCase>;
    updateMock = { execute: jest.fn(async () => ({ entity: makeWorker('w1') })) } as unknown as jest.Mocked<UpdateWorkerUseCase>;
    getMock = { execute: jest.fn(async () => ({ entity: makeWorker('w1'), crews: [] })) } as unknown as jest.Mocked<GetWorkerUseCase>;
    searchMock = { execute: jest.fn(async () => ({ entities: [makeWorker('w1'), makeWorker('w2', 'INACTIVE')], total: 2, crewsByUserId: new Map() })) } as unknown as jest.Mocked<SearchWorkersUseCase>;
    transitionMock = { execute: jest.fn(async () => ({ entity: makeWorker('w1'), alreadyInState: false })) } as unknown as jest.Mocked<StatusTransitionWorkerUseCase>;
    openWorkMock = { execute: jest.fn(async () => ({ openAssignments: 0 })) } as unknown as jest.Mocked<GetWorkerOpenWorkUseCase>;
    crewsMock = { execute: jest.fn(async () => ({ memberships: [] })) } as unknown as jest.Mocked<GetWorkerCrewsUseCase>;
    controller = new WorkersController(createMock, updateMock, getMock, searchMock, transitionMock, openWorkMock, crewsMock);
  });

  it('ADMIN có thể tạo worker', async () => {
    const res = await controller.create({ email: 'a@b.com', password: 'Secret123!', fullName: 'Test' } as never, adminReq() as never);
    expect(createMock.execute).toHaveBeenCalledWith(expect.objectContaining({ email: 'a@b.com', actorUserId: 'admin-1' }));
    expect(res.email).toBe('w1@example.com');
    expect((res as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it('non-ADMIN bị chặn', async () => {
    await expect(controller.create({ email: 'a@b.com', password: 'Secret123!', fullName: 'Test' } as never, workerReq() as never)).rejects.toThrow(ForbiddenException);
    await expect(controller.search(workerReq() as never, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined)).rejects.toThrow(ForbiddenException);
  });

  it('GET search filter đúng và server-side scope', async () => {
    const res = await controller.search(adminReq() as never, 'ACTIVE', 'worker', '11111111-1111-4111-8111-111111111111', '3', undefined, undefined, '10', '0');
    expect(searchMock.execute).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE', search: 'worker', tradeId: '11111111-1111-4111-8111-111111111111', skillLevel: 3, limit: 10, offset: 0 }));
    expect(res.data).toHaveLength(2);
    expect(res.total).toBe(2);
  });

  it('validation limit/tradeId/skillLevel', async () => {
    await expect(controller.search(adminReq() as never, undefined, undefined, 'not-uuid', undefined, undefined, undefined, undefined, undefined)).rejects.toThrow(BadRequestException);
    await expect(controller.search(adminReq() as never, undefined, undefined, undefined, '6', undefined, undefined, undefined, undefined)).rejects.toThrow(BadRequestException);
    await expect(controller.search(adminReq() as never, undefined, undefined, undefined, undefined, undefined, undefined, '0', undefined)).rejects.toThrow(BadRequestException);
  });

  describe('ORG-SRS-005 role widen READ-only (issue #28)', () => {
    it('PROJECT_MANAGER được đọc search + detail (read-only)', async () => {
      const res = await controller.search(pmReq() as never, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
      expect(searchMock.execute).toHaveBeenCalled();
      expect(res.total).toBe(2);
      const one = await controller.getOne('w1', pmReq() as never);
      expect(getMock.execute).toHaveBeenCalledWith({ workerId: 'w1' });
      expect((one as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
    });

    it('PROJECT_MANAGER gọi write (PATCH/status/open-work) → 403', async () => {
      await expect(controller.update('w1', { fullName: 'X' } as never, pmReq() as never)).rejects.toThrow(ForbiddenException);
      await expect(controller.changeStatus('w1', { action: 'SUSPEND', reason: 'x' } as never, pmReq() as never)).rejects.toThrow(ForbiddenException);
      await expect(controller.openWork('w1', pmReq() as never)).rejects.toThrow(ForbiddenException);
      expect(updateMock.execute).not.toHaveBeenCalled();
      expect(transitionMock.execute).not.toHaveBeenCalled();
      expect(openWorkMock.execute).not.toHaveBeenCalled();
    });

    it('sort/order hợp lệ được forward; sai → 400 kèm fieldErrors', async () => {
      await controller.search(adminReq() as never, undefined, undefined, undefined, undefined, 'name', 'asc', undefined, undefined);
      expect(searchMock.execute).toHaveBeenCalledWith(expect.objectContaining({ sort: 'name', order: 'asc' }));
      await controller.search(adminReq() as never, undefined, undefined, undefined, undefined, 'createdAt', 'desc', undefined, undefined);
      expect(searchMock.execute).toHaveBeenCalledWith(expect.objectContaining({ sort: 'createdAt', order: 'desc' }));

      const badSort = await controller.search(adminReq() as never, undefined, undefined, undefined, undefined, 'salary', undefined, undefined, undefined).catch((e: unknown) => e);
      expect(badSort).toBeInstanceOf(BadRequestException);
      expect((badSort as BadRequestException).getResponse()).toEqual({
        statusCode: 400,
        message: 'Sort không hợp lệ (name|createdAt)',
        fieldErrors: { sort: ['Sort không hợp lệ (name|createdAt)'] },
      });
      const badOrder = await controller.search(adminReq() as never, undefined, undefined, undefined, undefined, undefined, 'sideways', undefined, undefined).catch((e: unknown) => e);
      expect((badOrder as BadRequestException).getResponse()).toEqual({
        statusCode: 400,
        message: 'Order không hợp lệ (asc|desc)',
        fieldErrors: { order: ['Order không hợp lệ (asc|desc)'] },
      });
    });

    it('filter lỗi cũ giữ message text + thêm fieldErrors', async () => {
      const err = await controller.search(adminReq() as never, 'NOPE', undefined, undefined, undefined, undefined, undefined, undefined, undefined).catch((e: unknown) => e);
      expect((err as BadRequestException).getResponse()).toEqual({
        statusCode: 400,
        message: 'Trạng thái không hợp lệ',
        fieldErrors: { status: ['Trạng thái không hợp lệ'] },
      });
    });

    it('filter kết hợp status+tradeId+skillLevel vẫn pass', async () => {
      const res = await controller.search(adminReq() as never, 'ACTIVE', undefined, '11111111-1111-4111-8111-111111111111', '3', undefined, undefined, '10', '0');
      expect(searchMock.execute).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ACTIVE',
        tradeId: '11111111-1111-4111-8111-111111111111',
        skillLevel: 3,
      }));
      expect(res.total).toBe(2);
    });

    it('ORG-SRS-007 (issue #30, D9): crewId hợp lệ được forward; sai → 400 fieldErrors', async () => {
      const crewId = '22222222-2222-4222-8222-222222222222';
      await controller.search(adminReq() as never, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, crewId);
      expect(searchMock.execute).toHaveBeenCalledWith(expect.objectContaining({ crewId }));
      const err = await controller.search(adminReq() as never, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'not-uuid').catch((e: unknown) => e);
      expect((err as BadRequestException).getResponse()).toEqual({
        statusCode: 400,
        message: 'Crew ID không hợp lệ',
        fieldErrors: { crewId: ['Crew ID không hợp lệ'] },
      });
      expect(searchMock.execute).not.toHaveBeenCalledWith(expect.objectContaining({ crewId: 'not-uuid' }));
    });
  });

  it('update không hard delete — controller không expose DELETE', async () => {
    const proto = Object.getOwnPropertyNames(WorkersController.prototype);
    expect(proto.some((m) => /delete|remove|destroy/i.test(m))).toBe(false);
    const res = await controller.update('w1', { fullName: 'Updated' } as never, adminReq() as never);
    expect(updateMock.execute).toHaveBeenCalledWith(expect.objectContaining({ workerId: 'w1', fullName: 'Updated' }));
    expect(res.fullName).toBe('Worker w1');
  });

  it('getOne trả redacted và không leak passwordHash', async () => {
    const res = await controller.getOne('w1', adminReq() as never);
    expect((res as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
    expect(getMock.execute).toHaveBeenCalledWith({ workerId: 'w1' });
  });
  it('sửa ID/URL không bypass — cần ADMIN', async () => {
    await expect(controller.getOne('w1', workerReq() as never)).rejects.toThrow(ForbiddenException);
  });

  describe('X-Correlation-Id strict validation trên create/update (IAM-SRS-008, admin endpoints)', () => {
    const createDto = { email: 'a@b.com', password: 'Secret123!', fullName: 'Test' } as never;
    const updateDto = { fullName: 'Updated' } as never;

    it('create: hợp lệ → forwarded; sai → 400 actionable, không gọi use case; thiếu → null', async () => {
      await controller.create(createDto, adminReqWithCorr(VALID_CORR) as never);
      expect(createMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: VALID_CORR }));
      createMock.execute.mockClear();

      await expect(controller.create(createDto, adminReqWithCorr('not-a-uuid') as never)).rejects.toThrow(
        new BadRequestException('X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)'),
      );
      expect(createMock.execute).not.toHaveBeenCalled();

      await controller.create(createDto, adminReq() as never);
      expect(createMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: null }));
    });

    it('update: hợp lệ → forwarded; sai → 400 actionable, không gọi use case; thiếu → null', async () => {
      await controller.update('w1', updateDto, adminReqWithCorr(VALID_CORR) as never);
      expect(updateMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: VALID_CORR }));
      updateMock.execute.mockClear();

      await expect(controller.update('w1', updateDto, adminReqWithCorr('bf20-test-corr-001') as never)).rejects.toThrow(
        new BadRequestException('X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)'),
      );
      expect(updateMock.execute).not.toHaveBeenCalled();

      await controller.update('w1', updateDto, adminReq() as never);
      expect(updateMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: null }));
    });
  });

  describe('ORG-SRS-004 lifecycle endpoints (issue #27)', () => {
    it('PATCH :id/status — ADMIN transition: forward action/reason + metadata, response kèm alreadyInState', async () => {
      const res = await controller.changeStatus('w1', { action: 'SUSPEND', reason: 'Vắng mặt dài hạn' } as never, adminReqWithCorr(VALID_CORR) as never);
      expect(transitionMock.execute).toHaveBeenCalledWith(expect.objectContaining({
        workerId: 'w1',
        action: 'SUSPEND',
        reason: 'Vắng mặt dài hạn',
        actorUserId: 'admin-1',
        correlationId: VALID_CORR,
      }));
      expect(res.alreadyInState).toBe(false);
    });

    it('PATCH :id/status — non-ADMIN (PM/WORKER) bị chặn 403', async () => {
      await expect(controller.changeStatus('w1', { action: 'SUSPEND', reason: 'x' } as never, workerReq() as never)).rejects.toThrow(ForbiddenException);
      expect(transitionMock.execute).not.toHaveBeenCalled();
    });

    it('PATCH :id/status — reason optional cho ACTIVATE được forward null', async () => {
      await controller.changeStatus('w1', { action: 'ACTIVATE' } as never, adminReq() as never);
      expect(transitionMock.execute).toHaveBeenCalledWith(expect.objectContaining({ action: 'ACTIVATE', reason: null, correlationId: null }));
    });

    it('PATCH :id/status — response phản ánh warning {openAssignments} khi use case trả warning', async () => {
      transitionMock.execute.mockResolvedValue({ entity: makeWorker('w1', 'INACTIVE'), alreadyInState: false, warning: { openAssignments: 3 } });
      const res = await controller.changeStatus('w1', { action: 'TERMINATE', reason: 'Hết hợp đồng' } as never, adminReq() as never);
      expect(res.warning).toEqual({ openAssignments: 3 });
      expect(res.status).toBe('INACTIVE');
    });

    it('PATCH :id/status — alreadyInState=true (idempotent) hiển thị qua response', async () => {
      transitionMock.execute.mockResolvedValue({ entity: makeWorker('w1', 'INACTIVE'), alreadyInState: true });
      const res = await controller.changeStatus('w1', { action: 'SUSPEND', reason: 'x' } as never, adminReq() as never);
      expect(res.alreadyInState).toBe(true);
    });

    it('PATCH :id/status — X-Correlation-Id sai → 400 actionable, không gọi use case', async () => {
      await expect(controller.changeStatus('w1', { action: 'SUSPEND', reason: 'x' } as never, adminReqWithCorr('not-a-uuid') as never)).rejects.toThrow(
        new BadRequestException('X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)'),
      );
      expect(transitionMock.execute).not.toHaveBeenCalled();
    });

    it('GET :id/open-work — ADMIN được phép, trả {openAssignments}', async () => {
      openWorkMock.execute.mockResolvedValue({ openAssignments: 2 });
      const res = await controller.openWork('w1', adminReq() as never);
      expect(openWorkMock.execute).toHaveBeenCalledWith({ workerId: 'w1' });
      expect(res.openAssignments).toBe(2);
    });

    it('GET :id/open-work — non-ADMIN bị chặn 403', async () => {
      await expect(controller.openWork('w1', workerReq() as never)).rejects.toThrow(ForbiddenException);
      expect(openWorkMock.execute).not.toHaveBeenCalled();
    });
  });

  describe('ORG-03/ORG-05 Worker ↔ Crew link — GET :id/crews', () => {
    const membership = {
      crewId: '11111111-1111-4111-8111-111111111111',
      crewCode: 'CREW-A',
      crewName: 'Đội A',
      crewStatus: 'ACTIVE',
      memberRole: 'MEMBER',
      effectiveFrom: '2026-09-01',
      effectiveTo: null,
    };

    it('ADMIN + PROJECT_MANAGER được đọc (mirror GET /workers/:id), trả { data[] }', async () => {
      crewsMock.execute.mockResolvedValue({ memberships: [membership] } as never);
      for (const req of [adminReq(), pmReq()]) {
        const res = await controller.getCrews('w1', req as never);
        expect(crewsMock.execute).toHaveBeenCalledWith({ workerId: 'w1' });
        expect(res.data).toEqual([membership]);
      }
    });

    it('WORKER-role → 403, không gọi use case (guard mirror detail)', async () => {
      await expect(controller.getCrews('w1', workerReq() as never)).rejects.toThrow(ForbiddenException);
      expect(crewsMock.execute).not.toHaveBeenCalled();
    });

    it('worker không có membership → { data: [] }', async () => {
      crewsMock.execute.mockResolvedValue({ memberships: [] });
      const res = await controller.getCrews('w1', adminReq() as never);
      expect(res.data).toEqual([]);
    });

    it('read-only — không ghi audit (không nhận actor/meta, chỉ workerId)', async () => {
      crewsMock.execute.mockResolvedValue({ memberships: [] });
      await controller.getCrews('w1', adminReq() as never);
      expect(crewsMock.execute).toHaveBeenCalledWith({ workerId: 'w1' });
      expect(Object.keys(crewsMock.execute.mock.calls[0][0])).toEqual(['workerId']);
    });
  });

  describe('ORG-05 workers enrichment — crews[] ở list + detail', () => {
    it('GET search: crewsByUserId được merge vào từng profile', async () => {
      searchMock.execute.mockResolvedValue({
        entities: [makeWorker('w1')],
        total: 1,
        crewsByUserId: new Map([['w1', [{ crewId: 'c1', crewCode: 'CREW-A', crewName: 'Đội A', memberRole: 'LEAD' }]]]),
      });
      const res = await controller.search(adminReq() as never, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
      expect(res.data[0].crews).toEqual([{ crewId: 'c1', crewCode: 'CREW-A', crewName: 'Đội A', memberRole: 'LEAD' }]);
    });

    it('GET detail: crews từ use case được kèm vào profile', async () => {
      getMock.execute.mockResolvedValue({
        entity: makeWorker('w1'),
        crews: [{ crewId: 'c1', crewCode: 'CREW-A', crewName: 'Đội A', memberRole: 'MEMBER' }],
      });
      const res = await controller.getOne('w1', pmReq() as never);
      expect(res.crews).toEqual([{ crewId: 'c1', crewCode: 'CREW-A', crewName: 'Đội A', memberRole: 'MEMBER' }]);
    });
  });
});
