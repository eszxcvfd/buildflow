import { validateTradeCreate, validateTradeUpdate } from './trade.schema';

describe('trade schema ORG-SRS-003', () => {
  it('valid create passes', () => {
    const r = validateTradeCreate({ code: 'TR-001', name: 'Tho xay', description: 'Xay dung', status: 'ACTIVE' });
    expect(r.valid).toBe(true);
  });
  it('rejects empty code/name and invalid code charset', () => {
    const r1 = validateTradeCreate({ code: '', name: '', description: '', status: 'ACTIVE' });
    expect(r1.valid).toBe(false);
    expect(r1.fieldErrors.code).toBeDefined();
    expect(r1.fieldErrors.name).toBeDefined();

    const r2 = validateTradeCreate({ code: 'co dinh!', name: 'Tho', description: '', status: 'ACTIVE' });
    expect(r2.valid).toBe(false);
    expect(r2.fieldErrors.code?.[0]).toContain('chữ, số, _ và -');

    const r3 = validateTradeCreate({ code: 'A', name: 'Tho', description: '', status: 'ACTIVE' });
    expect(r3.fieldErrors.code?.[0]).toContain('2 đến 50');
  });
  it('rejects description over 500 and invalid status', () => {
    const r = validateTradeCreate({ code: 'TR-002', name: 'Tho', description: 'x'.repeat(501), status: 'BOGUS' });
    expect(r.valid).toBe(false);
    expect(r.fieldErrors.description).toBeDefined();
    expect(r.fieldErrors.status).toBeDefined();
  });
  it('update allows partial but rejects cleared required and oversize', () => {
    expect(validateTradeUpdate({ code: '', name: undefined }).valid).toBe(false);
    expect(validateTradeUpdate({ code: 'TR-001' }).valid).toBe(true);
    expect(validateTradeUpdate({ description: 'y'.repeat(501) }).valid).toBe(false);
    expect(validateTradeUpdate({ description: '' }).valid).toBe(true);
  });
});
