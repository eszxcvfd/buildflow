import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ProjectAttachments } from './ProjectAttachments';
import {
  listAttachments,
  uploadAttachment,
  downloadAttachment,
  retireAttachment,
} from '@/lib/api/attachments';

jest.mock('@/lib/api/attachments', () => ({
  listAttachments: jest.fn(),
  uploadAttachment: jest.fn(),
  downloadAttachment: jest.fn(),
  retireAttachment: jest.fn(),
  newRequestKey: jest.fn(() => 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'),
  ATTACHMENT_ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  ATTACHMENT_MAX_SIZE_BYTES: 10 * 1024 * 1024,
  ATTACHMENT_TEXT_MAX_LENGTH: 500,
}));

const listMock = listAttachments as jest.Mock;
const uploadMock = uploadAttachment as jest.Mock;
const downloadMock = downloadAttachment as jest.Mock;
const retireMock = retireAttachment as jest.Mock;

function setSessionRoles(codes: string[]) {
  window.localStorage.setItem(
    'buildflow.auth.v1',
    JSON.stringify({
      accessToken: 'token',
      expiresAt: '2099-01-01T00:00:00.000Z',
      user: { id: 'u-1', email: 'a@b.c', fullName: 'A', status: 'ACTIVE', userType: 'STAFF' },
      roles: codes.map((code, i) => ({ id: `r-${i}`, code, name: code })),
      projectIds: [],
    }),
  );
}

function attachment(overrides = {}) {
  return {
    id: 'att-1',
    projectId: 'p-1',
    workOrderId: null,
    ownerType: 'PROJECT',
    fileName: 'ban-ve.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    caption: 'Ban ve tang 1',
    isActive: true,
    deactivatedAt: null,
    deactivatedBy: null,
    deactivateReason: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  listMock.mockResolvedValue({ data: [], total: 0 });
});

describe('ProjectAttachments PRJ-SRS-009', () => {
  it('empty: hiển thị EmptyState khi chưa có tài liệu', async () => {
    setSessionRoles(['ADMIN']);
    render(<ProjectAttachments projectId="p-1" />);
    await waitFor(() => expect(screen.getByText('Chưa có tài liệu đính kèm')).not.toBeNull());
  });

  it('upload success: chọn file hợp lệ + caption → notice + reload list', async () => {
    setSessionRoles(['ADMIN']);
    render(<ProjectAttachments projectId="p-1" />);
    await waitFor(() => expect(screen.getByText('Chưa có tài liệu đính kèm')).not.toBeNull());
    uploadMock.mockResolvedValueOnce({ attachment: attachment(), idempotentReplay: false });
    listMock.mockResolvedValue({ data: [attachment()], total: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Tải lên' }));
    const input = screen.getByLabelText(/File \(JPEG/) as HTMLInputElement;
    const file = new File(['%PDF-1.4'], 'ban-ve.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText(/Chú thích/), { target: { value: 'Ban ve tang 1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tải lên' }));

    await waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(1));
    const [, payload] = uploadMock.mock.calls[0] as [string, { file: File; caption: string | null; requestKey: string }];
    expect(payload.file.name).toBe('ban-ve.pdf');
    expect(payload.caption).toBe('Ban ve tang 1');
    expect(payload.requestKey).toBe('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
    await waitFor(() => expect(screen.getByText(/Đã tải lên/)).not.toBeNull());
  });

  it('upload client validation: sai loại file báo lý do rõ, không gọi API', async () => {
    setSessionRoles(['ADMIN']);
    render(<ProjectAttachments projectId="p-1" />);
    await waitFor(() => expect(screen.getByText('Chưa có tài liệu đính kèm')).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Tải lên' }));
    const input = screen.getByLabelText(/File \(JPEG/) as HTMLInputElement;
    const bad = new File(['MZ'], 'evil.exe', { type: 'application/octet-stream' });
    fireEvent.change(input, { target: { files: [bad] } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tải lên' }));

    await waitFor(() => expect(screen.getByText(/Loại file không được hỗ trợ/)).not.toBeNull());
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('upload server 400: sai loại từ server map về field file', async () => {
    setSessionRoles(['ADMIN']);
    render(<ProjectAttachments projectId="p-1" />);
    await waitFor(() => expect(screen.getByText('Chưa có tài liệu đính kèm')).not.toBeNull());
    uploadMock.mockRejectedValueOnce({
      status: 400,
      message: 'Loại file không thuộc loại file được phê duyệt',
      fieldErrors: { file: ['Loại file không thuộc loại file được phê duyệt'] },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tải lên' }));
    const input = screen.getByLabelText(/File \(JPEG/) as HTMLInputElement;
    const file = new File(['%PDF-1.4'], 'ban-ve.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tải lên' }));

    await waitFor(() => expect(screen.getByText(/được phê duyệt/)).not.toBeNull());
  });

  it('retire: confirm + reason → notice success; inactive hiện badge + ẩn nút Ngừng sử dụng', async () => {
    setSessionRoles(['ADMIN']);
    listMock.mockResolvedValue({ data: [attachment()], total: 1 });
    render(<ProjectAttachments projectId="p-1" />);
    await waitFor(() => expect(screen.getByText('ban-ve.pdf')).not.toBeNull());
    retireMock.mockResolvedValueOnce({ attachment: attachment({ isActive: false }), alreadyInactive: false });
    listMock.mockResolvedValue({ data: [attachment({ isActive: false })], total: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Ngừng sử dụng' }));
    fireEvent.change(screen.getByLabelText(/Lý do/), { target: { value: 'Ban cu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận ngừng sử dụng' }));

    await waitFor(() => expect(retireMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText(/Đã ngừng sử dụng/)).not.toBeNull());
    await waitFor(() => expect(screen.getByText('Đã ngừng')).not.toBeNull());
    expect(screen.queryByRole('button', { name: 'Ngừng sử dụng' })).toBeNull();
    // Tải xuống vẫn khả dụng cho bản đã retire (API cho phép).
    expect(screen.getByRole('button', { name: 'Tải xuống' })).not.toBeNull();
  });

  it('retire alreadyInactive → notice info, không báo lỗi', async () => {
    setSessionRoles(['ADMIN']);
    listMock.mockResolvedValue({ data: [attachment()], total: 1 });
    retireMock.mockResolvedValueOnce({ attachment: attachment({ isActive: false }), alreadyInactive: true });
    render(<ProjectAttachments projectId="p-1" />);
    await waitFor(() => expect(screen.getByText('ban-ve.pdf')).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Ngừng sử dụng' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận ngừng sử dụng' }));

    await waitFor(() => expect(screen.getByText(/đã ngừng sử dụng trước đó/)).not.toBeNull());
  });

  it('download: gọi API blob + trigger anchor download', async () => {
    setSessionRoles(['ADMIN']);
    listMock.mockResolvedValue({ data: [attachment()], total: 1 });
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    downloadMock.mockResolvedValueOnce({ blob, contentType: 'application/pdf', fileName: 'ban-ve.pdf' });
    const createUrl = jest.fn(() => 'blob:mock-url');
    const revokeUrl = jest.fn();
    Object.defineProperty(window.URL, 'createObjectURL', { value: createUrl, writable: true });
    Object.defineProperty(window.URL, 'revokeObjectURL', { value: revokeUrl, writable: true });

    render(<ProjectAttachments projectId="p-1" />);
    await waitFor(() => expect(screen.getByText('ban-ve.pdf')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Tải xuống' }));

    await waitFor(() => expect(downloadMock).toHaveBeenCalledWith('p-1', 'att-1'));
    await waitFor(() => expect(createUrl).toHaveBeenCalledWith(blob));
  });

  it('403 list → graceful + retry; WORKER không thấy nút Tải lên', async () => {
    setSessionRoles(['WORKER']);
    listMock.mockRejectedValueOnce({ status: 403, message: 'Forbidden' });
    render(<ProjectAttachments projectId="p-1" />);
    await waitFor(() => expect(screen.getByText(/cần là thành viên dự án \(403\)/)).not.toBeNull());
    expect(screen.queryByRole('button', { name: 'Tải lên' })).toBeNull();
    listMock.mockResolvedValueOnce({ data: [], total: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(screen.getByText('Chưa có tài liệu đính kèm')).not.toBeNull());
  });
});
