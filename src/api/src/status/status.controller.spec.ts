import { StatusController } from './status.controller';

describe('StatusController', () => {
  it('returns v1 status', () => {
    const ctrl = new StatusController();
    const res = ctrl.getStatus();
    expect(res.status).toBe('ok');
    expect(res.version).toBe('v1');
    expect(res.service).toBe('buildflow-api');
  });
});
