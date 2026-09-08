import {
  searchWorkOrderTemplates,
  listActiveWorkOrderTemplates,
  getWorkOrderTemplate,
  createWorkOrderTemplate,
  updateWorkOrderTemplate,
  changeWorkOrderTemplateStatus,
  normalizeWorkOrderTemplate,
} from './work-order-templates';

function response(status: number, body: unknown, contentType = 'application/json') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    json: jest.fn(async () => body),
    text: jest.fn(async () => (typeof body === 'string' ? body : JSON.stringify(body))),
  } as unknown as Response;
}

const raw = {
  id: '55555555-5555-4555-8555-555555555555',
  code: 'WOT-001',
  name: 'Do be tong chuan',
  description: null,
  workTypeId: null,
  requiredTradeId: null,
  defaultDurationMinutes: 120,
  defaultPriority: 'NORMAL',
  requiredSkills: [{ code: 'THO-XAY', label: 'Tho xay' }],
  checklistSnapshot: [
    { title: 'Kiem tra cop pha', answerType: 'YES_NO', isRequired: true, isBlocking: false, requiresPhoto: false, sequenceNo: 1 },
  ],
  sourceChecklistTemplateId: null,
  status: 'DRAFT',
  version: 1,
  usableForNewWorkOrder: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('web work-order-template API client PRJ-SRS-008', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.NEXT_PUBLIC_API_URL = 'http://api.example.test';
    window.localStorage.clear();
  });

  it('normalizeWorkOrderTemplate suy isActive từ status', () => {
    expect(normalizeWorkOrderTemplate(raw).isActive).toBe(false);
    expect(normalizeWorkOrderTemplate({ ...raw, status: 'ACTIVE' }).isActive).toBe(true);
  });

  it('normalizeWorkOrderTemplate giữ workType kèm sẵn, mặc định null khi API thiếu', () => {
    expect(normalizeWorkOrderTemplate(raw).workType).toBeNull();
    const wt = { id: 'w1', code: 'WT-BE-TONG-TC', name: 'Đổ bê tông thủ công' };
    expect(normalizeWorkOrderTemplate({ ...raw, workType: wt }).workType).toEqual(wt);
  });

  it('searchWorkOrderTemplates dựng query status/workTypeId/search + auth; ALL bỏ status', async () => {
    fetchMock.mockResolvedValue(response(200, { data: [raw], total: 1, limit: 20, offset: 0 }));
    window.localStorage.setItem('buildflow.auth.v1', JSON.stringify({ accessToken: 'jwt-1' }));
    const res = await searchWorkOrderTemplates({
      search: 'tong',
      status: 'DRAFT',
      workTypeId: '44444444-4444-4444-8444-444444444444',
      limit: 20,
      offset: 0,
    });
    expect(res.data[0].isActive).toBe(false);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/work-order-templates?');
    expect(url).toContain('search=tong');
    expect(url).toContain('status=DRAFT');
    expect(url).toContain('workTypeId=44444444-4444-4444-8444-444444444444');
    expect((init as RequestInit).headers).toEqual(expect.objectContaining({ Authorization: 'Bearer jwt-1' }));

    fetchMock.mockResolvedValueOnce(response(200, { data: [], total: 0, limit: 20, offset: 0 }));
    await searchWorkOrderTemplates({ status: 'ALL' });
    expect(String(fetchMock.mock.calls[1][0])).not.toContain('status=');
  });

  it('listActiveWorkOrderTemplates gọi /active với cache no-store', async () => {
    fetchMock.mockResolvedValue(response(200, { data: [raw], total: 1 }));
    const res = await listActiveWorkOrderTemplates();
    expect(res.total).toBe(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/v1/work-order-templates/active');
    expect((init as RequestInit).cache).toBe('no-store');
  });

  it('getWorkOrderTemplate trả profile mọi status (kèm version)', async () => {
    fetchMock.mockResolvedValue(response(200, raw));
    const t = await getWorkOrderTemplate(raw.id);
    expect(t.version).toBe(1);
    expect(t.requiredSkills).toHaveLength(1);
    expect(t.checklistSnapshot).toHaveLength(1);
  });

  it('createWorkOrderTemplate POST JSON; 409 trùng code map về field code', async () => {
    fetchMock.mockResolvedValueOnce(response(201, raw));
    const created = await createWorkOrderTemplate({ code: 'WOT-001', name: 'Do be tong chuan' });
    expect(created.code).toBe('WOT-001');
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('POST');

    fetchMock.mockResolvedValueOnce(
      response(409, { message: 'Mã mẫu công việc đã tồn tại', code: 'WORK_ORDER_TEMPLATE_CODE_DUPLICATE' }),
    );
    await expect(createWorkOrderTemplate({ code: 'WOT-001', name: 'Khac' })).rejects.toMatchObject({
      status: 409,
      fieldErrors: { code: expect.arrayContaining(['Mã mẫu công việc đã tồn tại']) },
    });
  });

  it('updateWorkOrderTemplate PATCH và trả versionChanged; 409 xung đột map về expectedVersion', async () => {
    fetchMock.mockResolvedValueOnce(response(200, { ...raw, version: 2, versionChanged: true }));
    const res = await updateWorkOrderTemplate(raw.id, { name: 'Moi', expectedVersion: 1 });
    expect(res.versionChanged).toBe(true);
    expect(res.workOrderTemplate.version).toBe(2);
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('PATCH');

    fetchMock.mockResolvedValueOnce(
      response(409, { message: 'Mẫu đã được người khác cập nhật', code: 'WORK_ORDER_TEMPLATE_CONFIG_CONFLICT' }),
    );
    await expect(updateWorkOrderTemplate(raw.id, { name: 'Moi', expectedVersion: 1 })).rejects.toMatchObject({
      status: 409,
      fieldErrors: { expectedVersion: expect.any(Array) },
    });
  });

  it('changeWorkOrderTemplateStatus POST /:id/status với action; giữ alreadyInState', async () => {
    fetchMock.mockResolvedValueOnce(response(200, { ...raw, status: 'ACTIVE', alreadyInState: true }));
    const t = await changeWorkOrderTemplateStatus(raw.id, { action: 'ACTIVATE' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(`/api/v1/work-order-templates/${raw.id}/status`);
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ action: 'ACTIVATE' });
    expect(t.alreadyInState).toBe(true);
    expect(t.isActive).toBe(true);
  });

  it('400 publish rỗng map về field status', async () => {
    fetchMock.mockResolvedValueOnce(
      response(400, { message: 'Không thể kích hoạt mẫu rỗng', fieldErrors: { action: ['Không thể kích hoạt mẫu rỗng'] } }),
    );
    await expect(changeWorkOrderTemplateStatus(raw.id, { action: 'ACTIVATE' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { action: expect.any(Array) },
    });
  });

  it('giữ fieldErrors API shape mới { message, fieldErrors }', async () => {
    fetchMock.mockResolvedValueOnce(
      response(400, { message: 'Dữ liệu không hợp lệ', fieldErrors: { workTypeId: ['Loại công việc không tồn tại'] } }),
    );
    await expect(createWorkOrderTemplate({ code: 'WOT-002', name: 'X' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { workTypeId: ['Loại công việc không tồn tại'] },
    });
  });
});
