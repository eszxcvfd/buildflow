import { PgAuditRepository } from './pg-audit.repository';

// Unit-level contract for the audit write path (IAM-SRS-008).
// The pg pool seam is globalThis.__pgPool (same mechanism getPool() uses),
// so no real database is required here; integration proof is DATABASE_URL-gated
// in pg-audit.repository.integration.spec.ts.

function makeExecutorQuery(): jest.Mock {
  return jest.fn(async () => ({ rowCount: 1, rows: [] }));
}

function installFakePool(query: jest.Mock): void {
  (globalThis as unknown as { __pgPool?: unknown }).__pgPool = { query };
}

function releaseFakePool(): void {
  delete (globalThis as unknown as { __pgPool?: unknown }).__pgPool;
}

const BASE_PARAMS = {
  actorUserId: 'user-1',
  action: 'AUTH_LOGIN_SUCCESS',
  entityType: 'USER',
  entityId: 'user-1',
  afterData: { email: 'a@b.com' },
  result: 'SUCCESS' as const,
  ipAddress: '1.2.3.4',
  userAgent: 'jest',
};

describe('PgAuditRepository IAM-SRS-008 (unit)', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    releaseFakePool();
  });

  it('log với correlationId → INSERT ... ON CONFLICT (correlation_id, action) ... DO NOTHING', async () => {
    const query = makeExecutorQuery();
    installFakePool(query);
    const repo = new PgAuditRepository();

    await repo.log({ ...BASE_PARAMS, correlationId: 'corr-1' });

    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain('INSERT INTO public.audit_logs');
    expect(sql).toContain('ON CONFLICT (correlation_id, action) WHERE correlation_id IS NOT NULL DO NOTHING');
    expect(values[1]).toBe('AUTH_LOGIN_SUCCESS');
    expect(values[9]).toBe('corr-1');
  });

  it('log không có correlationId → INSERT thuần, không ON CONFLICT', async () => {
    const query = makeExecutorQuery();
    installFakePool(query);
    const repo = new PgAuditRepository();

    await repo.log({ ...BASE_PARAMS });

    const [sql, values] = query.mock.calls[0];
    expect(sql).not.toContain('ON CONFLICT');
    expect(values[9]).toBeNull();
  });

  it('idempotency: hai insert cùng (correlationId, action) — lần 2 no-op rowCount 0, không lỗi', async () => {
    // First call inserts (rowCount 1); second is deduped by the DB (rowCount 0).
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    installFakePool(query);
    const repo = new PgAuditRepository();

    await repo.log({ ...BASE_PARAMS, correlationId: 'corr-dup' });
    await repo.log({ ...BASE_PARAMS, correlationId: 'corr-dup' });

    expect(query).toHaveBeenCalledTimes(2);
    expect((query.mock.calls[0][0] as string)).toContain('DO NOTHING');
    expect((query.mock.calls[1][0] as string)).toContain('DO NOTHING');
    // Dedup must not be treated as a failure: no structured error line.
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('best-effort policy: lỗi transient → retry đúng 1 lần rồi thành công, không phá business flow', async () => {
    const transient = Object.assign(new Error('connection terminated'), { code: '08006' });
    const query = jest
      .fn()
      .mockRejectedValueOnce(transient)
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    installFakePool(query);
    const repo = new PgAuditRepository();

    await expect(repo.log({ ...BASE_PARAMS, correlationId: 'corr-retry' })).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(2);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('best-effort policy: lỗi non-transient → không retry, structured error log gồm correlationId + action, không log payload', async () => {
    const fatal = Object.assign(new Error('insert failed'), { code: '23503' });
    const query = jest.fn(async () => { throw fatal; });
    installFakePool(query);
    const repo = new PgAuditRepository();

    await expect(
      repo.log({ ...BASE_PARAMS, afterData: { email: 'a@b.com', note: 'TOPSECRET_PAYLOAD' }, correlationId: 'corr-fail' }),
    ).resolves.toBeUndefined();

    expect(query).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = errorSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.msg).toBe('audit_write_failed');
    expect(parsed.correlationId).toBe('corr-fail');
    expect(parsed.action).toBe('AUTH_LOGIN_SUCCESS');
    // secrets/payloads never reach the log line
    expect(line).not.toContain('TOPSECRET_PAYLOAD');
    expect(line).not.toContain('afterData');
    expect(line).not.toContain('a@b.com');
  });

  it('best-effort policy: transient hai lần liên tiếp → 1 retry rồi structured error log, vẫn không throw', async () => {
    const transient = Object.assign(new Error('timeout expired'), { code: 'ETIMEDOUT' });
    const query = jest.fn(async () => { throw transient; });
    installFakePool(query);
    const repo = new PgAuditRepository();

    await expect(repo.log({ ...BASE_PARAMS, correlationId: 'corr-outage' })).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(2); // initial + exactly one bounded retry
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(parsed.correlationId).toBe('corr-outage');
  });

  it('logWithClient: ghi qua client truyền vào, có ON CONFLICT khi có correlationId', async () => {
    const clientQuery = makeExecutorQuery();
    const repo = new PgAuditRepository();

    await repo.logWithClient({ query: clientQuery } as never, { ...BASE_PARAMS, correlationId: 'corr-tx' });

    expect(clientQuery).toHaveBeenCalledTimes(1);
    const [sql] = clientQuery.mock.calls[0];
    expect(sql).toContain('ON CONFLICT (correlation_id, action) WHERE correlation_id IS NOT NULL DO NOTHING');
  });

  it('logWithClient: insert thất bại thật → rethrow để business write abort (không retry trong tx)', async () => {
    const clientQuery = jest.fn(async () => { throw new Error('audit down'); });
    const repo = new PgAuditRepository();

    await expect(
      repo.logWithClient({ query: clientQuery } as never, { ...BASE_PARAMS, correlationId: 'corr-abort' }),
    ).rejects.toThrow('audit down');
    expect(clientQuery).toHaveBeenCalledTimes(1); // single attempt, no retry inside a tx
  });

  it('write-time secret guard: log() với forbidden key trong afterData → swallow best-effort, không chạm DB', async () => {
    const query = makeExecutorQuery();
    installFakePool(query);
    const repo = new PgAuditRepository();

    await expect(repo.log({ ...BASE_PARAMS, afterData: { password: 'x' } })).resolves.toBeUndefined();
    // guard chặn TRƯỚC khi INSERT — executor không bao giờ được gọi
    expect(query).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = errorSpy.mock.calls[0][0] as string;
    expect(line).toContain('audit write rejected: forbidden secret key in beforeData/afterData (IAM-SRS-008)');
    // giá trị payload không bao giờ xuất hiện trong log line
    expect(line).not.toContain('x');
  });

  it('write-time secret guard: logWithClient() với forbidden key → reject đúng message, client không bị gọi', async () => {
    const clientQuery = makeExecutorQuery();
    const repo = new PgAuditRepository();

    const caught: Error = await repo
      .logWithClient({ query: clientQuery } as never, { ...BASE_PARAMS, afterData: { password: 'x' } })
      .then(
        () => { throw new Error('expected secret guard to reject the write'); },
        (e: unknown) => e as Error,
      );

    expect(caught.message).toBe('audit write rejected: forbidden secret key in beforeData/afterData (IAM-SRS-008)');
    expect(caught.message).not.toContain('x');
    expect(clientQuery).not.toHaveBeenCalled();
  });
});
