import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { TradesController } from './trades.controller';
import { CreateTradeUseCase } from '../../../application/use-case/create-trade.use-case';
import { UpdateTradeUseCase } from '../../../application/use-case/update-trade.use-case';
import { ChangeTradeStatusUseCase } from '../../../application/use-case/change-trade-status.use-case';
import { GetTradeUseCase } from '../../../application/use-case/get-trade.use-case';
import { SearchTradesUseCase } from '../../../application/use-case/search-trades.use-case';
import { TradeEntity } from '../../../domain/entity/trade.entity';
import { TRADE_IN_USE_WARNING } from '../../../application/use-case/change-trade-status.use-case';

function makeTrade(id: string, isActive = true): TradeEntity {
  return new TradeEntity({
    id,
    code: `TRD-${id.slice(0, 3)}`,
    name: `Trade ${id}`,
    description: null,
    isActive,
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
function unauthReq(): unknown {
  return { headers: {}, ip: '127.0.0.1' } as unknown;
}

const VALID_CORR = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';

function adminReqWithCorr(correlationId: string): unknown {
  return { user: { sub: 'admin-1', roles: ['ADMIN'] }, headers: { 'user-agent': 'jest', 'x-correlation-id': correlationId }, ip: '127.0.0.1' } as unknown;
}

const TRADE_ID = '11111111-1111-4111-8111-111111111111';

describe('TradesController ORG-SRS-003', () => {
  let createMock: jest.Mocked<CreateTradeUseCase>;
  let updateMock: jest.Mocked<UpdateTradeUseCase>;
  let changeStatusMock: jest.Mocked<ChangeTradeStatusUseCase>;
  let getMock: jest.Mocked<GetTradeUseCase>;
  let searchMock: jest.Mocked<SearchTradesUseCase>;
  let controller: TradesController;

  beforeEach(() => {
    createMock = { execute: jest.fn(async () => ({ entity: makeTrade(TRADE_ID) })) } as unknown as jest.Mocked<CreateTradeUseCase>;
    updateMock = { execute: jest.fn(async () => ({ entity: makeTrade(TRADE_ID) })) } as unknown as jest.Mocked<UpdateTradeUseCase>;
    changeStatusMock = { execute: jest.fn(async () => ({ entity: makeTrade(TRADE_ID, false), warning: undefined })) } as unknown as jest.Mocked<ChangeTradeStatusUseCase>;
    getMock = { execute: jest.fn(async () => ({ entity: makeTrade(TRADE_ID) })) } as unknown as jest.Mocked<GetTradeUseCase>;
    searchMock = {
      execute: jest.fn(async () => ({ entities: [makeTrade(TRADE_ID), makeTrade('22222222-2222-4222-8222-222222222222', false)], total: 2 })),
    } as unknown as jest.Mocked<SearchTradesUseCase>;
    controller = new TradesController(createMock, updateMock, changeStatusMock, getMock, searchMock);
  });

  it('ADMIN có thể tạo trade — response chuẩn có assignable, không warning', async () => {
    const res = await controller.create({ code: 'TRD-001', name: 'Xay dung phan tho' } as never, adminReq() as never);
    expect(createMock.execute).toHaveBeenCalledWith(expect.objectContaining({ code: 'TRD-001', name: 'Xay dung phan tho', actorUserId: 'admin-1' }));
    expect(res.id).toBe(TRADE_ID);
    expect(res.assignable).toBe(true);
    expect(res.warning).toBeUndefined();
  });

  it('non-ADMIN bị Forbidden trên mọi endpoint; unauth bị Forbidden (guard chặn 401 trước)', async () => {
    await expect(controller.create({ code: 'TRD-001', name: 'A' } as never, nonAdminReq() as never)).rejects.toThrow(ForbiddenException);
    await expect(controller.search(nonAdminReq() as never, undefined, undefined, undefined, undefined)).rejects.toThrow(ForbiddenException);
    await expect(controller.getOne(TRADE_ID, nonAdminReq() as never)).rejects.toThrow(ForbiddenException);
    await expect(controller.update(TRADE_ID, { name: 'B' } as never, nonAdminReq() as never)).rejects.toThrow(ForbiddenException);
    await expect(controller.changeStatus(TRADE_ID, { status: 'INACTIVE' } as never, nonAdminReq() as never)).rejects.toThrow(ForbiddenException);
    // không bypass qua sửa URL/ID: thiếu user payload → 403 (JWT guard đã đảm bảo 401 trước khi vào controller)
    await expect(controller.create({ code: 'TRD-001', name: 'A' } as never, unauthReq() as never)).rejects.toThrow(ForbiddenException);
    await expect(controller.getOne(TRADE_ID, unauthReq() as never)).rejects.toThrow(ForbiddenException);
  });

  it('GET search filter đúng và trả list contract { data, total, limit, offset }', async () => {
    const res = await controller.search(adminReq() as never, 'ACTIVE', 'phan tho', '10', '0');
    expect(searchMock.execute).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE', search: 'phan tho', limit: 10, offset: 0 }));
    expect(res.data).toHaveLength(2);
    expect(res.total).toBe(2);
    expect(res.limit).toBe(10);
    expect(res.offset).toBe(0);
  });

  it('status không hợp lệ / limit / offset sai bị reject 400', async () => {
    await expect(controller.search(adminReq() as never, 'UNKNOWN', undefined, undefined, undefined)).rejects.toThrow(BadRequestException);
    await expect(controller.search(adminReq() as never, undefined, undefined, '0', undefined)).rejects.toThrow(BadRequestException);
    await expect(controller.search(adminReq() as never, undefined, undefined, '101', undefined)).rejects.toThrow(BadRequestException);
    await expect(controller.search(adminReq() as never, undefined, undefined, undefined, '-1')).rejects.toThrow(BadRequestException);
  });

  it('GET :id trả chi tiết; trade inactive vẫn xem được (lịch sử)', async () => {
    const res = await controller.getOne(TRADE_ID, adminReq() as never);
    expect(res.id).toBe(TRADE_ID);
    expect(getMock.execute).toHaveBeenCalledWith({ tradeId: TRADE_ID });
    getMock.execute.mockResolvedValue({ entity: makeTrade(TRADE_ID, false) });
    const inactive = await controller.getOne(TRADE_ID, adminReq() as never);
    expect(inactive.status).toBe('INACTIVE');
    expect(inactive.assignable).toBe(false);
  });

  it('PATCH :id update không expose DELETE', async () => {
    const proto = Object.getOwnPropertyNames(TradesController.prototype);
    expect(proto.some((m) => /delete|remove|destroy/i.test(m))).toBe(false);
    const res = await controller.update(TRADE_ID, { name: 'Beta' } as never, adminReq() as never);
    expect(updateMock.execute).toHaveBeenCalledWith(expect.objectContaining({ tradeId: TRADE_ID, name: 'Beta' }));
    expect(res.name).toBeDefined();
  });

  it('PATCH :id/status deactivate đang dùng → response kèm warning field', async () => {
    changeStatusMock.execute.mockResolvedValue({ entity: makeTrade(TRADE_ID, false), warning: TRADE_IN_USE_WARNING });
    const res = await controller.changeStatus(TRADE_ID, { status: 'INACTIVE' } as never, adminReq() as never);
    expect(changeStatusMock.execute).toHaveBeenCalledWith(expect.objectContaining({ tradeId: TRADE_ID, status: 'INACTIVE' }));
    expect(res.status).toBe('INACTIVE');
    expect(res.warning).toBe(TRADE_IN_USE_WARNING);
  });

  it('PATCH :id/status reactivate → response không warning', async () => {
    changeStatusMock.execute.mockResolvedValue({ entity: makeTrade(TRADE_ID, true), warning: undefined });
    const res = await controller.changeStatus(TRADE_ID, { status: 'ACTIVE' } as never, adminReq() as never);
    expect(res.status).toBe('ACTIVE');
    expect(res.warning).toBeUndefined();
  });

  // id param không hợp lệ bị ParseUUIDPipe chặn ở Nest layer (400) trước khi vào
  // controller — pipe chạy ngoài phạm vi unit test gọi method trực tiếp.

  describe('X-Correlation-Id strict validation trên create/update/changeStatus (IAM-SRS-008)', () => {
    const createDto = { code: 'TRD-002', name: 'Beta' } as never;
    const updateDto = { name: 'Beta2' } as never;
    const statusDto = { status: 'INACTIVE' } as never;

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

    it('update: hợp lệ → forwarded; sai → 400 actionable, không gọi use case', async () => {
      await controller.update(TRADE_ID, updateDto, adminReqWithCorr(VALID_CORR) as never);
      expect(updateMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: VALID_CORR }));
      updateMock.execute.mockClear();

      await expect(controller.update(TRADE_ID, updateDto, adminReqWithCorr('bf20-test-corr-001') as never)).rejects.toThrow(
        new BadRequestException('X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)'),
      );
      expect(updateMock.execute).not.toHaveBeenCalled();
    });

    it('changeStatus: hợp lệ → forwarded; sai → 400 actionable, không gọi use case', async () => {
      await controller.changeStatus(TRADE_ID, statusDto, adminReqWithCorr(VALID_CORR) as never);
      expect(changeStatusMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: VALID_CORR }));
      changeStatusMock.execute.mockClear();

      await expect(controller.changeStatus(TRADE_ID, statusDto, adminReqWithCorr('abc-123') as never)).rejects.toThrow(
        new BadRequestException('X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)'),
      );
      expect(changeStatusMock.execute).not.toHaveBeenCalled();
    });
  });
});