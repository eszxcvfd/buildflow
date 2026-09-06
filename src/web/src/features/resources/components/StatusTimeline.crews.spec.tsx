import { render, screen, waitFor } from '@testing-library/react';
import { StatusTimeline } from './StatusTimeline';
import { listAuditLogs } from '@/lib/api/audit-logs';

jest.mock('@/lib/api/audit-logs', () => ({ listAuditLogs: jest.fn() }));

const listAuditLogsMock = listAuditLogs as jest.Mock;

function log(overrides = {}) {
  return {
    id: 'log-1',
    action: 'ORG_CREW_SUSPENDED',
    entityType: 'CREW',
    entityId: 'crew-1',
    actorUserId: 'u-admin-1234567890',
    reason: 'Het viec',
    result: 'SUCCESS',
    createdAt: '2026-02-01T10:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('StatusTimeline CREW ORG-SRS-006', () => {
  it('render label tiếng Việt cho audit ORG_CREW_* + lý do', async () => {
    listAuditLogsMock.mockResolvedValue({ data: [log()], total: 1, limit: 10, offset: 0 });
    render(<StatusTimeline id="crew-1" entityType="CREW" />);
    await waitFor(() => expect(listAuditLogsMock).toHaveBeenCalled());
    expect(listAuditLogsMock).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'CREW', entityId: 'crew-1', result: 'SUCCESS', limit: 10 }),
    );
    await waitFor(() => expect(screen.getByText('Tạm ngừng')).not.toBeNull());
    expect(screen.getByText(/Lý do: Het viec/)).not.toBeNull();
  });

  it('label đổi trưởng nhóm ORG_CREW_LEAD_CHANGED', async () => {
    listAuditLogsMock.mockResolvedValue({
      data: [log({ id: 'log-2', action: 'ORG_CREW_LEAD_CHANGED', reason: null })],
      total: 1,
      limit: 10,
      offset: 0,
    });
    render(<StatusTimeline id="crew-1" entityType="CREW" />);
    await waitFor(() => expect(screen.getByText('Đổi trưởng nhóm')).not.toBeNull());
  });

  it('deep-link Xem trên Nhật ký thao tác giữ entityType CREW', async () => {
    listAuditLogsMock.mockResolvedValue({ data: [log()], total: 1, limit: 10, offset: 0 });
    render(<StatusTimeline id="crew-1" entityType="CREW" />);
    await waitFor(() => expect(screen.getByRole('link', { name: /Nhật ký thao tác/ })).not.toBeNull());
    expect(screen.getByRole('link', { name: /Nhật ký thao tác/ }).getAttribute('href')).toContain(
      'entityType=CREW&entityId=crew-1&result=SUCCESS',
    );
  });
});
