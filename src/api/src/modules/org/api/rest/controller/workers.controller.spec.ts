import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { WorkersController } from './workers.controller';
import { CreateWorkerUseCase } from '../../../application/use-case/create-worker.use-case';
import { UpdateWorkerUseCase } from '../../../application/use-case/update-worker.use-case';
import { GetWorkerUseCase } from '../../../application/use-case/get-worker.use-case';
import { SearchWorkersUseCase } from '../../../application/use-case/search-workers.use-case';
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

function workerReq(): unknown {
  return { user: { sub: 'user-1', roles: ['WORKER'] }, headers: {}, ip: '127.0.0.1' } as unknown;
}

describe('WorkersController ORG-SRS-001', () => {
  let createMock: jest.Mocked<CreateWorkerUseCase>;
  let updateMock: jest.Mocked<UpdateWorkerUseCase>;
  let getMock: jest.Mocked<GetWorkerUseCase>;
  let searchMock: jest.Mocked<SearchWorkersUseCase>;
  let controller: WorkersController;

  beforeEach(() => {
    createMock = { execute: jest.fn(async () => ({ entity: makeWorker('w1') })) } as unknown as jest.Mocked<CreateWorkerUseCase>;
    updateMock = { execute: jest.fn(async () => ({ entity: makeWorker('w1') })) } as unknown as jest.Mocked<UpdateWorkerUseCase>;
    getMock = { execute: jest.fn(async () => ({ entity: makeWorker('w1') })) } as unknown as jest.Mocked<GetWorkerUseCase>;
    searchMock = { execute: jest.fn(async () => ({ entities: [makeWorker('w1'), makeWorker('w2', 'INACTIVE')], total: 2 })) } as unknown as jest.Mocked<SearchWorkersUseCase>;
    controller = new WorkersController(createMock, updateMock, getMock, searchMock);
  });

  it('ADMIN có thể tạo worker', async () => {
    const res = await controller.create({ email: 'a@b.com', password: 'Secret123!', fullName: 'Test' } as never, adminReq() as never);
    expect(createMock.execute).toHaveBeenCalledWith(expect.objectContaining({ email: 'a@b.com', actorUserId: 'admin-1' }));
    expect(res.email).toBe('w1@example.com');
    expect((res as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it('non-ADMIN bị chặn', async () => {
    await expect(controller.create({ email: 'a@b.com', password: 'Secret123!', fullName: 'Test' } as never, workerReq() as never)).rejects.toThrow(ForbiddenException);
    await expect(controller.search(workerReq() as never, undefined, undefined, undefined, undefined, undefined, undefined)).rejects.toThrow(ForbiddenException);
  });

  it('GET search filter đúng và server-side scope', async () => {
    const res = await controller.search(adminReq() as never, 'ACTIVE', 'worker', '11111111-1111-4111-8111-111111111111', '3', '10', '0');
    expect(searchMock.execute).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE', search: 'worker', tradeId: '11111111-1111-4111-8111-111111111111', skillLevel: 3, limit: 10, offset: 0 }));
    expect(res.data).toHaveLength(2);
    expect(res.total).toBe(2);
  });

  it('validation limit/tradeId/skillLevel', async () => {
    await expect(controller.search(adminReq() as never, undefined, undefined, 'not-uuid', undefined, undefined, undefined)).rejects.toThrow(BadRequestException);
    await expect(controller.search(adminReq() as never, undefined, undefined, undefined, '6', undefined, undefined)).rejects.toThrow(BadRequestException);
    await expect(controller.search(adminReq() as never, undefined, undefined, undefined, undefined, '0', undefined)).rejects.toThrow(BadRequestException);
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
});
