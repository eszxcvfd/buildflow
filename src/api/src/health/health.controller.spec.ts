import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  it('liveness returns ok', async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();
    const ctrl = module.get(HealthController);
    const res = ctrl.liveness();
    expect(res.status).toBe('ok');
    expect(res.timestamp).toBeDefined();
  });

  it('readiness returns 503 when dependencies down', async () => {
    const mockService = {
      checkReadiness: jest.fn().mockResolvedValue({ status: 'error', checks: { postgres: 'down', redis: 'down' } }),
    };
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: mockService }],
    }).compile();
    const ctrl = module.get(HealthController);
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctrl.readiness({ status } as any);
    expect(status).toHaveBeenCalledWith(503);
  });

  it('readiness returns 200 when dependencies up', async () => {
    const mockService = {
      checkReadiness: jest.fn().mockResolvedValue({ status: 'ok', checks: { postgres: 'up', redis: 'up' } }),
    };
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: mockService }],
    }).compile();
    const ctrl = module.get(HealthController);
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctrl.readiness({ status } as any);
    expect(status).toHaveBeenCalledWith(200);
  });
});
