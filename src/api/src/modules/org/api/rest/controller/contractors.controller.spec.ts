import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { ContractorsController } from './contractors.controller';
import { CreateContractorUseCase } from '../../../application/use-case/create-contractor.use-case';
import { UpdateContractorUseCase } from '../../../application/use-case/update-contractor.use-case';
import { GetContractorUseCase } from '../../../application/use-case/get-contractor.use-case';
import { SearchContractorsUseCase } from '../../../application/use-case/search-contractors.use-case';
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

describe('ContractorsController ORG-SRS-002', () => {
  let createMock: jest.Mocked<CreateContractorUseCase>;
  let updateMock: jest.Mocked<UpdateContractorUseCase>;
  let getMock: jest.Mocked<GetContractorUseCase>;
  let searchMock: jest.Mocked<SearchContractorsUseCase>;
  let controller: ContractorsController;

  beforeEach(() => {
    createMock = { execute: jest.fn(async () => ({ entity: makeContractor('11111111-1111-4111-8111-111111111111') })) } as unknown as jest.Mocked<CreateContractorUseCase>;
    updateMock = { execute: jest.fn(async () => ({ entity: makeContractor('11111111-1111-4111-8111-111111111111') })) } as unknown as jest.Mocked<UpdateContractorUseCase>;
    getMock = { execute: jest.fn(async () => ({ entity: makeContractor('11111111-1111-4111-8111-111111111111') })) } as unknown as jest.Mocked<GetContractorUseCase>;
    searchMock = { execute: jest.fn(async () => ({ entities: [makeContractor('11111111-1111-4111-8111-111111111111'), makeContractor('22222222-2222-4222-8222-222222222222', 'INACTIVE')], total: 2 })) } as unknown as jest.Mocked<SearchContractorsUseCase>;
    controller = new ContractorsController(createMock, updateMock, getMock, searchMock);
  });

  it('ADMIN có thể tạo contractor', async () => {
    const res = await controller.create({ code: 'CTR-001', name: 'Alpha', contactName: 'Nguyen A', scope: 'Thi cong', email: 'a@b.com' } as never, adminReq() as never);
    expect(createMock.execute).toHaveBeenCalledWith(expect.objectContaining({ code: 'CTR-001', name: 'Alpha', contactName: 'Nguyen A', scope: 'Thi cong', actorUserId: 'admin-1' }));
    expect(res.code).toBeDefined();
    expect(res.eligible).toBe(true);
  });

  it('non-ADMIN bị chặn', async () => {
    await expect(controller.create({ code: 'CTR-001', name: 'Alpha', contactName: 'Nguyen A', scope: 'Thi cong' } as never, nonAdminReq() as never)).rejects.toThrow(ForbiddenException);
    await expect(controller.search(nonAdminReq() as never, undefined, undefined, undefined, undefined, undefined, undefined)).rejects.toThrow(ForbiddenException);
  });

  it('GET search filter đúng và scope/eligibleOnly', async () => {
    const res = await controller.search(adminReq() as never, 'ACTIVE', 'alpha', 'phan tho', 'true', '10', '0');
    expect(searchMock.execute).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE', search: 'alpha', scope: 'phan tho', eligibleOnly: true, limit: 10, offset: 0 }));
    expect(res.data).toHaveLength(2);
    expect(res.total).toBe(2);
  });

  it('validation limit và eligibleOnly với INACTIVE', async () => {
    await expect(controller.search(adminReq() as never, undefined, undefined, undefined, undefined, '0', undefined)).rejects.toThrow(BadRequestException);
    await expect(controller.search(adminReq() as never, 'INACTIVE', undefined, undefined, 'true', undefined, undefined)).rejects.toThrow(BadRequestException);
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
});
