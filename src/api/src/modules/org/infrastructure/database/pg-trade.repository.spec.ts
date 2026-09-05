import { TradeEntity } from '../../domain/entity/trade.entity';
import { PgTradeRepository } from './pg-trade.repository';

// Mapper/contract-level tests (no real DB needed). Real DB integration lives
// in migration + repository integration flows with DATABASE_URL set.

describe('PgTradeRepository ORG-SRS-003 (mapper + SQL contract)', () => {
  it('mapRow-equivalent mapping preserves fields', () => {
    const row = {
      id: '11111111-1111-4111-8111-111111111111',
      code: 'TRD-001',
      name: 'Xay dung phan tho',
      description: 'Mo ta',
      is_active: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
    };
    const entity = new TradeEntity({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      description: row.description,
      isActive: Boolean(row.is_active),
      createdAt: new Date(String(row.created_at)),
      updatedAt: new Date(String(row.updated_at)),
    });
    expect(entity.code).toBe('TRD-001');
    expect(entity.name).toBe('Xay dung phan tho');
    expect(entity.description).toBe('Mo ta');
    expect(entity.isAssignable()).toBe(true);
    expect(entity.toPublic().assignable).toBe(true);
    expect(entity.toPublic().status).toBe('ACTIVE');
  });

  it('inactive row maps isAssignable false', () => {
    const entity = new TradeEntity({
      id: '33333333-3333-4333-8333-333333333333',
      code: 'TRD-002',
      name: 'Beta',
      description: null,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(entity.isInactive()).toBe(true);
    expect(entity.isAssignable()).toBe(false);
    expect(entity.toPublic().status).toBe('INACTIVE');
  });

  it('repository contract exposes search/create/save/countActiveUsage for catalog lifecycle', () => {
    const proto = PgTradeRepository.prototype;
    const methods = Object.getOwnPropertyNames(proto);
    for (const m of ['findById', 'findByIds', 'findAllActive', 'findByCode', 'search', 'create', 'save', 'saveWithClient', 'countActiveUsage']) {
      expect(methods).toContain(m);
    }
    // no hard delete anywhere in the trade repository surface
    expect(methods.some((m) => /delete|remove|destroy/i.test(m))).toBe(false);
  });
});