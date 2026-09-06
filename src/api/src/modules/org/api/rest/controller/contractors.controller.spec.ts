import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { ContractorsController } from './contractors.controller';
import { CreateContractorUseCase } from '../../../application/use-case/create-contractor.use-case';
import { UpdateContractorUseCase } from '../../../application/use-case/update-contractor.use-case';
import { GetContractorUseCase } from '../../../application/use-case/get-contractor.use-case';
import { SearchContractorsUseCase } from '../../../application/use-case/search-contractors.use-case';
import { StatusTransitionContractorUseCase } from '../../../application/use-case/status-transition-contractor.use-case';
import { GetContractorOpenWorkUseCase } from '../../../application/use-case/get-contractor-open-work.use-case';
import { ContractorEntity } from '../../../domain/entity/contractor.entity';

function makeContractor(id: string, status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE'): ContractorEntity {
  return new ContractorEntity({
    id,
    code: `CTR-${id.slice(0, 3)}`,
    name: `Contractor ${id}`,
    contactName: 'Nguyen Van A',
    phone: '+84901234567',
    email: `${id}@example.com`,
    status,
    scope: 'Thi cong phan tho',
    createdBy: '22222222-2222-4222-8222-222222222222',
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  });
}

function adminReq(): unknown {
  return { user: { sub: 'admin-1', roles: ['ADMIN'] }, headers: { 'user-agent': 'jest' }, ip: '127.0.0.1' } as unknown;
}
function nonAdminReq(): unknown {
  return { user: { sub: 'user-1', roles: ['WORKER'] }, headers: {}, ip: '127.0.0.1' } as unknown;
}
function pmReq(): unknown {
  return { user: { sub: 'pm-1', roles: ['PROJECT_MANAGER'] }, headers: { 'user-agent': 'jest' }, ip: '127.0.0.1' } as unknown;
}

const VALID_CORR = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';

function adminReqWithCorr(correlationId: string): unknown {
  return { user: { sub: 'admin-1', roles: ['ADMIN'] }, headers: { 'user-agent': 'jest', 'x-correlation-id': correlationId }, ip: '127.0.0.1' } as unknown;
}

describe('ContractorsController ORG-SRS-002', () => {
  let createMock: jest.Mocked<CreateContractorUseCase>;
  let updateMock: jest.Mocked<UpdateContractorUseCase>;
  let getMock: jest.Mocked<GetContractorUseCase>;
  let searchMock: jest.Mocked<SearchContractorsUseCase>;
  let transitionMock: jest.Mocked<StatusTransitionContractorUseCase>;
  let openWorkMock: jest.Mocked<GetContractorOpenWorkUseCase>;
  let controller: ContractorsController;

  beforeEach(() => {
    createMock = { execute: jest.fn(async () => ({ entity: makeContractor('11111111-1111-4111-8111-111111111111') })) } as unknown as jest.Mocked<CreateContractorUseCase>;
    updateMock = { execute: jest.fn(async () => ({ entity: makeContractor('11111111-1111-4111-8111-111111111111') })) } as unknown as jest.Mocked<UpdateContractorUseCase>;
    getMock = { execute: jest.fn(async () => ({ entity: makeContractor('11111111-1111-4111-8111-111111111111') })) } as unknown as jest.Mocked<GetContractorUseCase>;
    searchMock = { execute: jest.fn(async () => ({ entities: [makeContractor('11111111-1111-4111-8111-111111111111'), makeContractor('22222222-2222-4222-8222-222222222222', 'INACTIVE')], total: 2 })) } as unknown as jest.Mocked<SearchContractorsUseCase>;
    transitionMock = { execute: jest.fn(async () => ({ entity: makeContractor('11111111-1111-4111-8111-111111111111'), alreadyInState: false })) } as unknown as jest.Mocked<StatusTransitionContractorUseCase>;
    openWorkMock = { execute: jest.fn(async () => ({ openAssignments: 0 })) } as unknown as jest.Mocked<GetContractorOpenWorkUseCase>;
    controller = new ContractorsController(createMock, updateMock, getMock, searchMock, transitionMock, openWorkMock);
  });

  it('ADMIN có thể tạo contractor', async () => {
    const res = await controller.create({ code: 'CTR-001', name: 'Alpha', contactName: 'Nguyen A', scope: 'Thi cong', email: 'a@b.com' } as never, adminReq() as never);
    expect(createMock.execute).toHaveBeenCalledWith(expect.objectContaining({ code: 'CTR-001', name: 'Alpha', contactName: 'Nguyen A', scope: 'Thi cong', actorUserId: 'admin-1' }));
    expect(res.code).toBeDefined();
    expect(res.eligible).toBe(true);
  });

  it('non-ADMIN bị chặn', async () => {
    await expect(controller.create({ code: 'CTR-001', name: 'Alpha', contactName: 'Nguyen A', scope: 'Thi cong' } as never, nonAdminReq() as never)).rejects.toThrow(ForbiddenException);
    await expect(controller.search(nonAdminReq() as never, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined)).rejects.toThrow(ForbiddenException);
  });

  it('GET search filter đúng và scope/eligibleOnly', async () => {
    const res = await controller.search(adminReq() as never, 'ACTIVE', 'alpha', 'phan tho', 'true', undefined, undefined, '10', '0');
    expect(searchMock.execute).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE', search: 'alpha', scope: 'phan tho', eligibleOnly: true, limit: 10, offset: 0 }));
    expect(res.data).toHaveLength(2);
    expect(res.total).toBe(2);
  });

  it('validation limit và eligibleOnly với INACTIVE', async () => {
    await expect(controller.search(adminReq() as never, undefined, undefined, undefined, undefined, undefined, undefined, '0', undefined)).rejects.toThrow(BadRequestException);
    await expect(controller.search(adminReq() as never, 'INACTIVE', undefined, undefined, 'true', undefined, undefined, undefined, undefined)).rejects.toThrow(BadRequestException);
  });

  describe('ORG-SRS-005 role widen READ-only (issue #28)', () => {
    const CID = '11111111-1111-4111-8111-111111111111';

    it('PROJECT_MANAGER được đọc search + detail (read-only)', async () => {
      const res = await controller.search(pmReq() as never, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
      expect(searchMock.execute).toHaveBeenCalled();
      expect(res.total).toBe(2);
      const one = await controller.getOne(CID, pmReq() as never);
      expect(getMock.execute).toHaveBeenCalledWith({ contractorId: CID });
      expect(one.id).toBe(CID);
    });

    it('PROJECT_MANAGER gọi write (PATCH/status/open-work) → 403', async () => {
      await expect(controller.update(CID, { name: 'X' } as never, pmReq() as never)).rejects.toThrow(ForbiddenException);
      await expect(controller.changeStatus(CID, { action: 'SUSPEND', reason: 'x' } as never, pmReq() as never)).rejects.toThrow(ForbiddenException);
      await expect(controller.openWork(CID, pmReq() as never)).rejects.toThrow(ForbiddenException);
      expect(updateMock.execute).not.toHaveBeenCalled();
      expect(transitionMock.execute).not.toHaveBeenCalled();
      expect(openWorkMock.execute).not.toHaveBeenCalled();
    });

    it('sort/order hợp lệ được forward; sai → 400 kèm fieldErrors', async () => {
      await controller.search(adminReq() as never, undefined, undefined, undefined, undefined, 'name', 'asc', undefined, undefined);
      expect(searchMock.execute).toHaveBeenCalledWith(expect.objectContaining({ sort: 'name', order: 'asc' }));

      const badSort = await controller.search(adminReq() as never, undefined, undefined, undefined, undefined, 'nope', undefined, undefined, undefined).catch((e: unknown) => e);
      expect((badSort as BadRequestException).getResponse()).toEqual({
        statusCode: 400,
        message: 'Sort không hợp lệ (name|createdAt)',
        fieldErrors: { sort: ['Sort không hợp lệ (name|createdAt)'] },
      });
      const badOrder = await controller.search(adminReq() as never, undefined, undefined, undefined, undefined, undefined, 'nope', undefined, undefined).catch((e: unknown) => e);
      expect((badOrder as BadRequestException).getResponse()).toEqual({
        statusCode: 400,
        message: 'Order không hợp lệ (asc|desc)',
        fieldErrors: { order: ['Order không hợp lệ (asc|desc)'] },
      });
    });

    it('eligibleOnly + INACTIVE giữ message text + thêm fieldErrors', async () => {
      const err = await controller.search(adminReq() as never, 'INACTIVE', undefined, undefined, 'true', undefined, undefined, undefined, undefined).catch((e: unknown) => e);
      expect((err as BadRequestException).getResponse()).toEqual({
        statusCode: 400,
        message: 'Không thể lọc eligibleOnly với INACTIVE',
        fieldErrors: { eligibleOnly: ['Không thể lọc eligibleOnly với INACTIVE'] },
      });
    });
  });

  it('update không hard delete — controller không expose DELETE', async () => {
    const proto = Object.getOwnPropertyNames(ContractorsController.prototype);
    expect(proto.some((m) => /delete|remove|destroy/i.test(m))).toBe(false);
    const res = await controller.update('11111111-1111-4111-8111-111111111111', { name: 'Beta' } as never, adminReq() as never);
    expect(updateMock.execute).toHaveBeenCalledWith(expect.objectContaining({ contractorId: '11111111-1111-4111-8111-111111111111', name: 'Beta' }));
    expect(res.name).toBeDefined();
  });

  it('getOne trả eligible và không leak internal', async () => {
    const res = await controller.getOne('11111111-1111-4111-8111-111111111111', adminReq() as never);
    expect(res.id).toBe('11111111-1111-4111-8111-111111111111');
    expect(getMock.execute).toHaveBeenCalledWith({ contractorId: '11111111-1111-4111-8111-111111111111' });
  });

  it('sửa ID/URL không bypass — cần ADMIN', async () => {
    await expect(controller.getOne('11111111-1111-4111-8111-111111111111', nonAdminReq() as never)).rejects.toThrow(ForbiddenException);
  });

  it('INACTIVE contractor vẫn truy được chi tiết (lịch sử)', async () => {
    getMock.execute.mockResolvedValue({ entity: makeContractor('33333333-3333-4333-8333-333333333333', 'INACTIVE') });
    const res = await controller.getOne('33333333-3333-4333-8333-333333333333', adminReq() as never);
    expect(res.status).toBe('INACTIVE');
    expect(res.eligible).toBe(false);
  });

  describe('X-Correlation-Id strict validation trên create/update (IAM-SRS-008, admin endpoints)', () => {
    const createDto = { code: 'CTR-002', name: 'Beta', contactName: 'Nguyen B', scope: 'Thi cong' } as never;
    const updateDto = { name: 'Beta2' } as never;
    const id = '11111111-1111-4111-8111-111111111111';

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
      await controller.update(id, updateDto, adminReqWithCorr(VALID_CORR) as never);
      expect(updateMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: VALID_CORR }));
      updateMock.execute.mockClear();

      await expect(controller.update(id, updateDto, adminReqWithCorr('bf20-test-corr-001') as never)).rejects.toThrow(
        new BadRequestException('X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)'),
      );
      expect(updateMock.execute).not.toHaveBeenCalled();

      await controller.update(id, updateDto, adminReq() as never);
      expect(updateMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: null }));
    });
  });

  describe('ORG-SRS-004 lifecycle endpoints (issue #27)', () => {
    const CID = '11111111-1111-4111-8111-111111111111';

    it('PATCH :id/status — ADMIN transition: forward action/reason + metadata, response kèm alreadyInState', async () => {
      const res = await controller.changeStatus(CID, { action: 'SUSPEND', reason: 'Vi phạm hợp đồng' } as never, adminReqWithCorr(VALID_CORR) as never);
      expect(transitionMock.execute).toHaveBeenCalledWith(expect.objectContaining({
        contractorId: CID,
        action: 'SUSPEND',
        reason: 'Vi phạm hợp đồng',
        actorUserId: 'admin-1',
        correlationId: VALID_CORR,
      }));
      expect(res.alreadyInState).toBe(false);
    });

    it('PATCH :id/status — non-ADMIN bị chặn 403', async () => {
      await expect(controller.changeStatus(CID, { action: 'TERMINATE', reason: 'x' } as never, nonAdminReq() as never)).rejects.toThrow(ForbiddenException);
      expect(transitionMock.execute).not.toHaveBeenCalled();
    });

    it('PATCH :id/status — ACTIVATE reason optional, response không warning khi use case không báo', async () => {
      const res = await controller.changeStatus(CID, { action: 'ACTIVATE' } as never, adminReq() as never);
      expect(transitionMock.execute).toHaveBeenCalledWith(expect.objectContaining({ action: 'ACTIVATE', reason: null }));
      expect(res.alreadyInState).toBe(false);
      expect((res as Record<string, unknown>).warning).toBeUndefined();
    });

    it('PATCH :id/status — response phản ánh warning {openAssignments}', async () => {
      transitionMock.execute.mockResolvedValue({ entity: makeContractor(CID, 'INACTIVE'), alreadyInState: false, warning: { openAssignments: 2 } });
      const res = await controller.changeStatus(CID, { action: 'SUSPEND', reason: 'x' } as never, adminReq() as never);
      expect(res.warning).toEqual({ openAssignments: 2 });
      expect(res.status).toBe('INACTIVE');
    });

    it('PATCH :id/status — X-Correlation-Id sai → 400 actionable, không gọi use case', async () => {
      await expect(controller.changeStatus(CID, { action: 'TERMINATE', reason: 'x' } as never, adminReqWithCorr('not-a-uuid') as never)).rejects.toThrow(
        new BadRequestException('X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)'),
      );
      expect(transitionMock.execute).not.toHaveBeenCalled();
    });

    it('GET :id/open-work — ADMIN được phép, trả {openAssignments}', async () => {
      openWorkMock.execute.mockResolvedValue({ openAssignments: 5 });
      const res = await controller.openWork(CID, adminReq() as never);
      expect(openWorkMock.execute).toHaveBeenCalledWith({ contractorId: CID });
      expect(res.openAssignments).toBe(5);
    });

    it('GET :id/open-work — non-ADMIN bị chặn 403', async () => {
      await expect(controller.openWork(CID, nonAdminReq() as never)).rejects.toThrow(ForbiddenException);
      expect(openWorkMock.execute).not.toHaveBeenCalled();
    });
  });
});
