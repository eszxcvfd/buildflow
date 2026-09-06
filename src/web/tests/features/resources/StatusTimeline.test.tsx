/**
 * DOM-level tests cho StatusTimeline (ORG-SRS-004, GitHub issue #27).
 * Regression E2E ORG-SRS-004 B5: deep-link sang /admin/audit-logs KHÔNG được
 * kèm param action prefix (ORG_WORKER/ORG_CONTRACTOR) — API audit lọc action
 * EXACT-MATCH nên prefix cho 0 dòng. Link chỉ mang entityType + entityId + result.
 */
import * as React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { StatusTimeline } from '@/features/resources/components/StatusTimeline';

jest.mock('@/lib/api/audit-logs', () => ({
  __esModule: true,
  listAuditLogs: jest.fn(),
}));

import { listAuditLogs } from '@/lib/api/audit-logs';

const listMock = listAuditLogs as jest.Mock;

function makeLog(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'log-1',
    actorUserId: 'admin-1',
    action: 'ORG_WORKER_SUSPENDED',
    entityType: 'WORKER',
    entityId: 'w-1',
    beforeData: null,
    afterData: null,
    reason: 'Tạm ngừng do thiếu việc',
    result: 'SUCCESS',
    ipAddress: null,
    userAgent: 'jest',
    correlationId: null,
    createdAt: '2026-09-06T07:30:00.000Z',
    ...overrides,
  };
}

describe('StatusTimeline deep-link (ORG-SRS-004 B5)', () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  afterEach(cleanup);

  it('WORKER: link Xem trên Nhật ký thao tác mang entityType+entityId+result, KHÔNG có action=', async () => {
    listMock.mockResolvedValueOnce({ data: [makeLog()], total: 1, limit: 10, offset: 0 });
    render(<StatusTimeline id="w-1" entityType="WORKER" />);
    const link = (await screen.findByText('Xem trên Nhật ký thao tác')) as HTMLAnchorElement;
    const href = link.getAttribute('href') ?? '';
    expect(href).toContain('entityType=WORKER');
    expect(href).toContain('entityId=w-1');
    expect(href).toContain('result=SUCCESS');
    expect(href).not.toContain('action=');
  });

  it('CONTRACTOR: link không có action prefix ORG_CONTRACTOR', async () => {
    listMock.mockResolvedValueOnce({
      data: [makeLog({ id: 'log-2', action: 'ORG_CONTRACTOR_SUSPENDED', entityType: 'CONTRACTOR', entityId: 'c-1' })],
      total: 1,
      limit: 10,
      offset: 0,
    });
    render(<StatusTimeline id="c-1" entityType="CONTRACTOR" />);
    const link = (await screen.findByText('Xem trên Nhật ký thao tác')) as HTMLAnchorElement;
    const href = link.getAttribute('href') ?? '';
    expect(href).toBe('/admin/audit-logs?entityType=CONTRACTOR&entityId=c-1&result=SUCCESS');
  });

  it('timeline gọi API với entityType+entityId+result=SUCCESS+limit=10', async () => {
    listMock.mockResolvedValueOnce({ data: [makeLog()], total: 5, limit: 10, offset: 0 });
    render(<StatusTimeline id="w-1" entityType="WORKER" />);
    await screen.findByText('Xem tất cả 5 bản ghi trên Nhật ký thao tác');
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'WORKER', entityId: 'w-1', result: 'SUCCESS', limit: 10 }),
    );
  });
});
