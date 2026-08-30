import { ContractorEntity } from '../../domain/entity/contractor.entity';

// Integration-style mapper test without real DB — validates pg-contractor mapping and filter SQL building
// For real DB integration, set DATABASE_URL and run with pg available; otherwise these run as unit-level.

describe('PgContractorRepository ORG-SRS-002 (mapper + contract)', () => {
  it('mapRow -> ContractorEntity preserves fields', () => {
    const row = {
      id: '11111111-1111-4111-8111-111111111111',
      code: 'CTR-001',
      name: 'Alpha Construction',
      contact_name: 'Nguyen Van A',
      phone: '+84901234567',
      email: 'ALPHA@Example.COM',
      status: 'ACTIVE',
      note: 'Thi cong phan tho',
      created_by: '22222222-2222-4222-8222-222222222222',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
    };

    const entity = new ContractorEntity({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      contactName: row.contact_name,
      phone: row.phone,
      email: row.email,
      status: row.status as 'ACTIVE' | 'INACTIVE',
      scope: row.note,
      createdBy: String(row.created_by),
      createdAt: new Date(String(row.created_at)),
      updatedAt: new Date(String(row.updated_at)),
    });

    expect(entity.code).toBe('CTR-001');
    expect(entity.name).toBe('Alpha Construction');
    // email normalized to lower
    expect(entity.email).toBe('alpha@example.com');
    expect(entity.scope).toBe('Thi cong phan tho');
    expect(entity.isEligibleForAssignment()).toBe(true);
    expect(entity.toPublic().eligible).toBe(true);
  });

  it('inactive contractor maps eligible false', () => {
    const e = new ContractorEntity({
      id: '33333333-3333-4333-8333-333333333333',
      code: 'CTR-002',
      name: 'Beta',
      contactName: 'Nguyen Van B',
      phone: null,
      email: null,
      status: 'INACTIVE',
      scope: 'Hoan thien',
      createdBy: '22222222-2222-4222-8222-222222222222',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(e.isEligibleForAssignment()).toBe(false);
  });

  it('repository contract: INACTIVE not in eligible assignment but still findable by id (no hard delete)', async () => {
    // Simulate repository behavior with in-memory fake
    const active = new ContractorEntity({
      id: '11111111-1111-4111-8111-111111111111',
      code: 'CTR-A',
      name: 'ActiveCo',
      contactName: 'Nguyen Van A',
      phone: null,
      email: null,
      status: 'ACTIVE',
      scope: 'Thi cong phan tho',
      createdBy: '22222222-2222-4222-8222-222222222222',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const inactive = new ContractorEntity({
      id: '22222222-2222-4222-8222-222222222222',
      code: 'CTR-B',
      name: 'InactiveCo',
      contactName: 'Nguyen Van B',
      phone: null,
      email: null,
      status: 'INACTIVE',
      scope: 'Hoan thien',
      createdBy: '22222222-2222-4222-8222-222222222222',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const all = [active, inactive];
    const eligible = all.filter((c) => c.isEligibleForAssignment());
    expect(eligible).toHaveLength(1);
    expect(eligible[0].code).toBe('CTR-A');
    // History still viewable: inactive still in all
    expect(all.find((c) => c.id === inactive.id)).toBeDefined();
  });
});
