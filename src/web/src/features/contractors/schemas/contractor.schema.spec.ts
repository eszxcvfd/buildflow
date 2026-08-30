import { validateContractorCreate, validateContractorUpdate } from './contractor.schema';

describe('contractor schema ORG-SRS-002', () => {
  it('valid create passes', () => {
    const r = validateContractorCreate({ code: 'CTR-001', name: 'Alpha', contactName: 'Nguyen A', phone: '+84901234567', email: 'a@example.com', scope: 'Thi cong phan tho', status: 'ACTIVE' });
    expect(r.valid).toBe(true);
  });
  it('thiếu contact/scope phải reject', () => {
    const r1 = validateContractorCreate({ code: 'CTR-001', name: 'Alpha', contactName: '', phone: '', email: '', scope: '', status: 'ACTIVE' });
    expect(r1.valid).toBe(false);
    expect(r1.fieldErrors.contactName).toBeDefined();
    expect(r1.fieldErrors.scope).toBeDefined();
    const r2 = validateContractorCreate({ code: 'CTR-001', name: 'Alpha', contactName: '   ', phone: '', email: '', scope: 'Thi cong', status: 'ACTIVE' });
    expect(r2.valid).toBe(false);
    expect(r2.fieldErrors.contactName).toBeDefined();
  });
  it('update cho phép partial nhưng không cho clear required', () => {
    const r = validateContractorUpdate({ contactName: '', scope: '' });
    expect(r.valid).toBe(false);
    expect(r.fieldErrors.contactName).toBeDefined();
  });
});
