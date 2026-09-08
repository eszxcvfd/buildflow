import {
  uploadAttachment,
  listAttachments,
  downloadAttachment,
  retireAttachment,
  newRequestKey,
  newCorrelationId,
  ATTACHMENT_MAX_SIZE_BYTES,
} from './attachments';

function response(status: number, body: unknown, contentType = 'application/json') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    json: jest.fn(async () => body),
    text: jest.fn(async () => (typeof body === 'string' ? body : JSON.stringify(body))),
  } as unknown as Response;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const ATT_ID = '22222222-2222-4222-8222-222222222222';

const profile = {
  id: ATT_ID,
  projectId: PROJECT_ID,
  workOrderId: null,
  ownerType: 'PROJECT',
  fileName: 'ban-ve.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  caption: 'Ban ve tang 1',
  isActive: true,
  deactivatedAt: null,
  deactivatedBy: null,
  deactivateReason: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('web attachments API client PRJ-SRS-009', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.NEXT_PUBLIC_API_URL = 'http://api.example.test';
    window.localStorage.clear();
  });

  it('newRequestKey/newCorrelationId sinh UUID hợp lệ', () => {
    expect(newRequestKey()).toMatch(UUID_RE);
    expect(newCorrelationId()).toMatch(UUID_RE);
  });

  it('uploadAttachment gửi FormData (không set Content-Type thủ công) + Bearer + X-Correlation-Id; 201 → replay false', async () => {
    fetchMock.mockResolvedValueOnce(response(201, profile));
    window.localStorage.setItem('buildflow.auth.v1', JSON.stringify({ accessToken: 'jwt-1' }));
    const file = new File(['%PDF-1.4'], 'ban-ve.pdf', { type: 'application/pdf' });
    const res = await uploadAttachment(
      PROJECT_ID,
      { file, caption: 'Ban ve', requestKey: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' },
      { correlationId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb' },
    );
    expect(res.attachment.fileName).toBe('ban-ve.pdf');
    expect(res.idempotentReplay).toBe(false);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`http://api.example.test/api/v1/projects/${PROJECT_ID}/attachments`);
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer jwt-1');
    expect(headers['X-Correlation-Id']).toBe('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb');
    expect(headers['Content-Type']).toBeUndefined();
    const form = init.body as FormData;
    expect(form.get('caption')).toBe('Ban ve');
    expect(form.get('requestKey')).toBe('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
    expect((form.get('file') as File).name).toBe('ban-ve.pdf');
  });

  it('uploadAttachment replay requestKey → 200 + idempotentReplay true', async () => {
    fetchMock.mockResolvedValueOnce(response(200, { ...profile, idempotentReplay: true }));
    const file = new File(['%PDF-1.4'], 'ban-ve.pdf', { type: 'application/pdf' });
    const res = await uploadAttachment(PROJECT_ID, { file });
    expect(res.idempotentReplay).toBe(true);
  });

  it('uploadAttachment 400 sai loại → fieldErrors.file với lý do rõ', async () => {
    fetchMock.mockResolvedValueOnce(
      response(400, { message: 'Loại file không thuộc loại file được phê duyệt', fieldErrors: { file: ['Loại file không thuộc loại file được phê duyệt'] } }),
    );
    const file = new File(['MZ'], 'evil.exe', { type: 'application/octet-stream' });
    const err = await uploadAttachment(PROJECT_ID, { file }).catch((e) => e);
    expect(err.status).toBe(400);
    expect(err.fieldErrors.file.join(' ')).toMatch(/phê duyệt/);
  });

  it('uploadAttachment 400 quá 10MB (message-only) → map về fieldErrors.file', async () => {
    fetchMock.mockResolvedValueOnce(response(400, { message: `Tệp quá lớn — tối đa ${ATTACHMENT_MAX_SIZE_BYTES} byte (10MB)` }));
    expect(ATTACHMENT_MAX_SIZE_BYTES).toBe(10 * 1024 * 1024);
    const file = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    const err = await uploadAttachment(PROJECT_ID, { file }).catch((e) => e);
    expect(err.status).toBe(400);
    expect(err.fieldErrors.file).toBeDefined();
  });

  it('listAttachments GET no-store + Bearer → { data, total }', async () => {
    fetchMock.mockResolvedValueOnce(response(200, { data: [profile], total: 1 }));
    window.localStorage.setItem('buildflow.auth.v1', JSON.stringify({ accessToken: 'jwt-1' }));
    const res = await listAttachments(PROJECT_ID);
    expect(res.total).toBe(1);
    expect(res.data[0].id).toBe(ATT_ID);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`http://api.example.test/api/v1/projects/${PROJECT_ID}/attachments`);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-1');
    expect(init.cache).toBe('no-store');
  });

  it('downloadAttachment GET content + Bearer (không token trong URL) → blob', async () => {
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          const n = name.toLowerCase();
          if (n === 'content-type') return 'application/pdf';
          if (n === 'content-disposition') return 'attachment; filename="ban-ve.pdf"';
          return null;
        },
      },
      blob: jest.fn(async () => blob),
      json: jest.fn(),
      text: jest.fn(),
    } as unknown as Response);
    window.localStorage.setItem('buildflow.auth.v1', JSON.stringify({ accessToken: 'jwt-1' }));
    const res = await downloadAttachment(PROJECT_ID, ATT_ID);
    expect(res.blob).toBe(blob);
    expect(res.fileName).toBe('ban-ve.pdf');
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`http://api.example.test/api/v1/projects/${PROJECT_ID}/attachments/${ATT_ID}/content`);
    expect(url).not.toContain('jwt-1');
  });

  it('retireAttachment PATCH + X-Correlation-Id → profile; alreadyInactive passthrough', async () => {
    fetchMock.mockResolvedValueOnce(response(200, { ...profile, isActive: false, alreadyInactive: true }));
    window.localStorage.setItem('buildflow.auth.v1', JSON.stringify({ accessToken: 'jwt-1' }));
    const res = await retireAttachment(PROJECT_ID, ATT_ID, { reason: 'Trung lap' }, { correlationId: 'cccccccc-cccc-4ccc-cccc-cccccccccccc' });
    expect(res.alreadyInactive).toBe(true);
    expect(res.attachment.isActive).toBe(false);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/attachments/${ATT_ID}/retire`);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ reason: 'Trung lap' });
    expect((init.headers as Record<string, string>)['X-Correlation-Id']).toBe('cccccccc-cccc-4ccc-cccc-cccccccccccc');
  });

  it('retireAttachment 400 reason dài → fieldErrors.reason', async () => {
    fetchMock.mockResolvedValueOnce(
      response(400, { message: 'Lý do quá dài', fieldErrors: { reason: ['Lý do quá dài — tối đa 500 ký tự'] } }),
    );
    const err = await retireAttachment(PROJECT_ID, ATT_ID, { reason: 'x'.repeat(501) }).catch((e) => e);
    expect(err.status).toBe(400);
    expect(err.fieldErrors.reason).toBeDefined();
  });
});
