import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { EligibilityController } from './eligibility.controller';
import { CheckWorkerEligibilityUseCase } from '../../../application/use-case/check-worker-eligibility.use-case';
import { CheckCrewEligibilityUseCase } from '../../../application/use-case/check-crew-eligibility.use-case';
import { JwtAuthGuard } from '../../../../iam/api/rest/guard/jwt-auth.guard';

const WID = '11111111-1111-4111-8111-111111111111';
const CID = '22222222-2222-4222-8222-222222222222';
const TRADE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const VALID_CORR = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';

function workerOut() {
  return {
    resourceType: 'WORKER' as const,
    resourceId: WID,
    eligible: true,
    checkedAt: '2026-09-06T00:00:00.000Z',
    correlationId: VALID_CORR,
    conditions: [],
    crews: [],
  };
}

function crewOut() {
  return {
    resourceType: 'CREW' as const,
    resourceId: CID,
    eligible: true,
    checkedAt: '2026-09-06T00:00:00.000Z',
    correlationId: VALID_CORR,
    conditions: [],
    members: [],
  };
}

function adminReq(): unknown {
  return { user: { sub: 'admin-1', roles: ['ADMIN'] }, headers: {}, ip: '127.0.0.1' } as unknown;
}
function pmReq(): unknown {
  return { user: { sub: 'pm-1', roles: ['PROJECT_MANAGER'] }, headers: {}, ip: '127.0.0.1' } as unknown;
}
function workerReq(sub = 'user-1'): unknown {
  return { user: { sub, roles: ['WORKER'] }, headers: {}, ip: '127.0.0.1' } as unknown;
}
function reqWithCorr(roles: string[], correlationId: string, sub = 'u-1'): unknown {
  return { user: { sub, roles }, headers: { 'x-correlation-id': correlationId }, ip: '127.0.0.1' } as unknown;
}

describe('EligibilityController ORG-SRS-008 (issue #31)', () => {
  let workerMock: jest.Mocked<CheckWorkerEligibilityUseCase>;
  let crewMock: jest.Mocked<CheckCrewEligibilityUseCase>;
  let controller: EligibilityController;

  beforeEach(() => {
    workerMock = { execute: jest.fn(async () => workerOut()) } as unknown as jest.Mocked<CheckWorkerEligibilityUseCase>;
    crewMock = { execute: jest.fn(async () => crewOut()) } as unknown as jest.Mocked<CheckCrewEligibilityUseCase>;
    controller = new EligibilityController(workerMock, crewMock);
  });

  describe('role matrix', () => {
    it('ADMIN ok trên workers/:id + crews/:id', async () => {
      await controller.checkWorker(WID, adminReq() as never, undefined, undefined, undefined);
      expect(workerMock.execute).toHaveBeenCalledWith(expect.objectContaining({ workerId: WID }));
      await controller.checkCrew(CID, adminReq() as never);
      expect(crewMock.execute).toHaveBeenCalledWith(expect.objectContaining({ crewId: CID }));
    });

    it('PROJECT_MANAGER ok trên workers/:id + crews/:id', async () => {
      await controller.checkWorker(WID, pmReq() as never, undefined, undefined, undefined);
      await controller.checkCrew(CID, pmReq() as never);
      expect(workerMock.execute).toHaveBeenCalled();
      expect(crewMock.execute).toHaveBeenCalled();
    });

    it('WORKER trên /workers/:id và /crews/:id → 403, không gọi use case', async () => {
      await expect(controller.checkWorker(WID, workerReq() as never, undefined, undefined, undefined)).rejects.toThrow(ForbiddenException);
      await expect(controller.checkCrew(CID, workerReq() as never)).rejects.toThrow(ForbiddenException);
      expect(workerMock.execute).not.toHaveBeenCalled();
      expect(crewMock.execute).not.toHaveBeenCalled();
    });

    it('WORKER trên /me → ok, resolve theo JWT sub (không check role)', async () => {
      const res = await controller.checkMe(workerReq('jwt-worker-sub') as never, undefined, undefined, undefined);
      expect(workerMock.execute).toHaveBeenCalledWith(expect.objectContaining({ workerId: 'jwt-worker-sub' }));
      expect(res.resourceId).toBe(WID);
    });

    it('anon → 401: controller gắn JwtAuthGuard; guard thiếu Bearer → Unauthorized', async () => {
      const guards = Reflect.getMetadata('__guards__', EligibilityController) as unknown[];
      expect(guards.map((g) => (g as { name?: string }).name ?? String(g))).toContain('JwtAuthGuard');
      const guard = new JwtAuthGuard(
        { verify: jest.fn() } as never,
        { isRevoked: jest.fn() } as never,
        {} as never,
      );
      const ctx = {
        switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      } as never;
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('query validation → 400', () => {
    it('tradeId sai uuid → 400 fieldErrors {tradeId}', async () => {
      const err = await controller
        .checkWorker(WID, adminReq() as never, 'not-a-uuid', undefined, undefined)
        .catch((e: unknown) => e);
      expect((err as BadRequestException).getResponse()).toEqual({
        statusCode: 400,
        message: 'Trade ID không hợp lệ',
        fieldErrors: { tradeId: ['Trade ID không hợp lệ'] },
      });
      expect(workerMock.execute).not.toHaveBeenCalled();
    });

    it('skillLevel ngoài 1-5 / không phải số → 400 fieldErrors {skillLevel}', async () => {
      await expect(controller.checkWorker(WID, adminReq() as never, undefined, '0', undefined)).rejects.toThrow(BadRequestException);
      await expect(controller.checkWorker(WID, adminReq() as never, undefined, '6', undefined)).rejects.toThrow(BadRequestException);
      await expect(controller.checkWorker(WID, adminReq() as never, undefined, 'abc', undefined)).rejects.toThrow(BadRequestException);
      expect(workerMock.execute).not.toHaveBeenCalled();
    });

    it('at sai → 400 fieldErrors {at}; đúng → forward; thiếu → default today', async () => {
      await expect(controller.checkWorker(WID, adminReq() as never, undefined, undefined, '2026-13-01')).rejects.toThrow(BadRequestException);
      await expect(controller.checkWorker(WID, adminReq() as never, undefined, undefined, 'tomorrow')).rejects.toThrow(BadRequestException);
      expect(workerMock.execute).not.toHaveBeenCalled();
      await controller.checkWorker(WID, adminReq() as never, TRADE, '3', '2026-09-01');
      expect(workerMock.execute).toHaveBeenCalledWith(expect.objectContaining({
        workerId: WID, tradeId: TRADE, skillLevel: 3, at: '2026-09-01',
      }));
    });

    it('/me validate query giống /workers/:id', async () => {
      await expect(controller.checkMe(workerReq() as never, 'bad', undefined, undefined)).rejects.toThrow(BadRequestException);
      expect(workerMock.execute).not.toHaveBeenCalled();
    });
  });

  describe('correlation lenient (read-only, không audit)', () => {
    it('header hợp lệ → forward; sai → vẫn forward raw (use case tự generate), không 400', async () => {
      await controller.checkWorker(WID, reqWithCorr(['ADMIN'], VALID_CORR) as never, undefined, undefined, undefined);
      expect(workerMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: VALID_CORR }));
      workerMock.execute.mockClear();
      await controller.checkWorker(WID, reqWithCorr(['ADMIN'], 'not-a-uuid') as never, undefined, undefined, undefined);
      expect(workerMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: 'not-a-uuid' }));
      await controller.checkCrew(CID, reqWithCorr(['PROJECT_MANAGER'], 'bad') as never);
      expect(crewMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: 'bad' }));
    });
  });
});
