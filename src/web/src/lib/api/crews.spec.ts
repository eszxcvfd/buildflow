import {
  listCrews,
  getCrew,
  createCrew,
  updateCrew,
  changeCrewLifecycleStatus,
  getCrewOpenWork,
  listCrewMembers,
  addCrewMember,
  removeCrewMember,
  type Crew,
} from './crews';

function makeCrew(overrides: Partial<Crew> = {}): Crew {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    code: 'TEAM-001',
    name: 'Doi ket cau',
    description: null,
    contractorId: null,
    status: 'ACTIVE',
    eligible: true,
    leaderUserId: '11111111-1111-4111-8111-111111111111',
    createdBy: 'u-admin',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function response(status: number, body: unknown, contentType = 'application/json') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name === 'content-type' ? contentType : null) },
    json: jest.fn(async () => body),
    text: jest.fn(async () => String(body)),
  } as unknown as Response;
}

describe('web crews API client ORG-SRS-006', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.NEXT_PUBLIC_API_URL = 'http://api.example.test';
    window.localStorage.clear();
  });

  it('listCrews builds query and sends auth header', async () => {
    fetchMock.mockResolvedValue(response(200, { data: [], total: 0, limit: 20, offset: 0 }));
    window.localStorage.setItem('buildflow.auth.v1', JSON.stringify({ accessToken: 'jwt-1' }));
    await listCrews({ search: 'ket cau', status: 'ACTIVE', eligibleOnly: true, sort: 'name', order: 'asc', limit: 20, offset: 0 });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/crews?'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer jwt-1' }),
      }),
    );
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('search=ket+cau');
    expect(url).toContain('status=ACTIVE');
    expect(url).toContain('eligibleOnly=true');
    expect(url).toContain('sort=name');
    expect(url).toContain('order=asc');
  });

  it('getCrew uses no-store read', async () => {
    fetchMock.mockResolvedValue(response(200, makeCrew()));
    const crew = await getCrew('crew-1');
    expect(crew.code).toBe('TEAM-001');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/crews/crew-1'),
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('createCrew maps 409 duplicate code onto field code', async () => {
    fetchMock.mockResolvedValue(response(409, { message: 'Mã đội đã tồn tại' }));
    await expect(createCrew({ code: 'TEAM-001', name: 'X', leaderUserId: 'u-1' })).rejects.toMatchObject({
      status: 409,
      fieldErrors: { code: ['Mã đội đã tồn tại'] },
    });
  });

  it('updateCrew maps 409 active-lead race onto field leaderUserId', async () => {
    fetchMock.mockResolvedValue(response(409, { message: 'Đội đã có trưởng nhóm đang hiệu lực' }));
    await expect(updateCrew('crew-1', { leaderUserId: 'u-2' })).rejects.toMatchObject({
      status: 409,
      fieldErrors: { leaderUserId: ['Đội đã có trưởng nhóm đang hiệu lực'] },
    });
  });

  it('createCrew keeps server fieldErrors for invalid leader', async () => {
    fetchMock.mockResolvedValue(
      response(400, { message: 'Dữ liệu không hợp lệ', fieldErrors: { leaderUserId: ['Trưởng nhóm không hợp lệ'] } }),
    );
    await expect(createCrew({ code: 'TEAM-002', name: 'Y', leaderUserId: 'bad' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { leaderUserId: ['Trưởng nhóm không hợp lệ'] },
    });
  });

  it('changeCrewLifecycleStatus returns alreadyInState + warning', async () => {
    fetchMock.mockResolvedValue(
      response(200, { ...makeCrew({ status: 'INACTIVE', eligible: false }), alreadyInState: false, warning: { openAssignments: 3 } }),
    );
    const res = await changeCrewLifecycleStatus('crew-1', { action: 'SUSPEND', reason: 'Tam ngung' });
    expect(res.alreadyInState).toBe(false);
    expect(res.warning).toEqual({ openAssignments: 3 });
    expect(res.status).toBe('INACTIVE');
  });

  it('changeCrewLifecycleStatus maps reason 400 onto field reason', async () => {
    fetchMock.mockResolvedValue(response(400, { message: 'Lý do là bắt buộc khi tạm ngừng/chấm dứt' }));
    await expect(changeCrewLifecycleStatus('crew-1', { action: 'SUSPEND' })).rejects.toMatchObject({
      status: 400,
      fieldErrors: { reason: ['Lý do là bắt buộc khi tạm ngừng/chấm dứt'] },
    });
  });

  it('getCrewOpenWork returns openAssignments count', async () => {
    fetchMock.mockResolvedValue(response(200, { openAssignments: 2 }));
    await expect(getCrewOpenWork('crew-1')).resolves.toEqual({ openAssignments: 2 });
  });

  it('ORG-SRS-007 — listCrewMembers dùng no-store + query at/includeInactive', async () => {
    fetchMock.mockResolvedValue(response(200, { data: [], total: 0 }));
    await listCrewMembers('crew-1', { at: '2026-01-15' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/crews/crew-1/members?at=2026-01-15'),
      expect.objectContaining({ cache: 'no-store' }),
    );
    fetchMock.mockClear();
    await listCrewMembers('crew-1', { includeInactive: true });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('includeInactive=true');
  });

  it('ORG-SRS-007 — addCrewMember 201 tách warning MEMBER_IN_OTHER_CREW', async () => {
    fetchMock.mockResolvedValue(
      response(201, {
        id: 'm-1',
        userId: 'u-1',
        memberRole: 'MEMBER',
        effectiveFrom: '2026-02-01',
        effectiveTo: null,
        isActive: true,
        addedBy: 'admin',
        createdAt: '2026-02-01T00:00:00.000Z',
        userName: 'Nguyen Van M',
        userCode: 'NV-002',
        warning: { code: 'MEMBER_IN_OTHER_CREW', otherCrews: [{ crewId: 'c-2', crewCode: 'T2', crewName: 'Doi 2' }] },
      }),
    );
    const res = await addCrewMember('crew-1', { userId: 'u-1', effectiveFrom: null });
    expect(res.userId).toBe('u-1');
    expect(res.warning?.code).toBe('MEMBER_IN_OTHER_CREW');
    expect(res.warning?.otherCrews).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/crews/crew-1/members'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('ORG-SRS-007 — addCrewMember giữ code MEMBER_DUPLICATE cho form map field', async () => {
    fetchMock.mockResolvedValue(response(409, { statusCode: 409, message: 'Thành viên đã thuộc đội', code: 'MEMBER_DUPLICATE' }));
    await expect(addCrewMember('crew-1', { userId: 'u-1' })).rejects.toMatchObject({
      status: 409,
      code: 'MEMBER_DUPLICATE',
    });
  });

  it('ORG-SRS-007 — removeCrewMember tách alreadyRemoved', async () => {
    fetchMock.mockResolvedValue(
      response(200, {
        id: 'm-1',
        userId: 'u-1',
        memberRole: 'MEMBER',
        effectiveFrom: '2026-02-01',
        effectiveTo: '2026-03-01',
        isActive: false,
        addedBy: 'admin',
        createdAt: '2026-02-01T00:00:00.000Z',
        userName: null,
        userCode: null,
        alreadyRemoved: true,
      }),
    );
    const res = await removeCrewMember('crew-1', 'm-1', { effectiveTo: '2026-03-01', reason: null });
    expect(res.alreadyRemoved).toBe(true);
    expect(res.isActive).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/crews/crew-1/members/m-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
