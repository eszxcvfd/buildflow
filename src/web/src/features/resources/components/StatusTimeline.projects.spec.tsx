import { render, screen, waitFor } from '@testing-library/react';
import { StatusTimeline } from './StatusTimeline';
import { listAuditLogs } from '@/lib/api/audit-logs';

jest.mock('@/lib/api/audit-logs', () => ({ listAuditLogs: jest.fn() }));

const listAuditLogsMock = listAuditLogs as jest.Mock;

function log(overrides = {}) {
  return {
    id: 'log-1',
    action: 'PRJ_PROJECT_STATUS_CHANGED',
    entityType: 'PROJECT',
    entityId: 'p-1',
    actorUserId: 'u-admin-1234567890',
    reason: 'Tam dung de bao tri',
    result: 'SUCCESS',
    createdAt: '2026-02-01T10:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('StatusTimeline PROJECT PRJ-SRS-002 (issue #33)', () => {
  it('render label tiếng Việt cho PRJ_PROJECT_STATUS_CHANGED + lý do', async () => {
    listAuditLogsMock.mockResolvedValue({ data: [log()], total: 1, limit: 10, offset: 0 });
    render(<StatusTimeline id="p-1" entityType="PROJECT" />);
    await waitFor(() => expect(listAuditLogsMock).toHaveBeenCalled());
    expect(listAuditLogsMock).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'PROJECT', entityId: 'p-1', result: 'SUCCESS', limit: 10 }),
    );
    await waitFor(() => expect(screen.getByText('Đổi trạng thái dự án')).not.toBeNull());
    expect(screen.getByText(/Lý do: Tam dung de bao tri/)).not.toBeNull();
  });

  it('deep-link Xem trên Nhật ký thao tác giữ entityType PROJECT', async () => {
    listAuditLogsMock.mockResolvedValue({ data: [log()], total: 1, limit: 10, offset: 0 });
    render(<StatusTimeline id="p-1" entityType="PROJECT" />);
    await waitFor(() => expect(screen.getByRole('link', { name: /Nhật ký thao tác/ })).not.toBeNull());
    expect(screen.getByRole('link', { name: /Nhật ký thao tác/ }).getAttribute('href')).toContain(
      'entityType=PROJECT&entityId=p-1&result=SUCCESS',
    );
  });
});
