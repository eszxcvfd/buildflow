import { fetchJobBoard, fetchJobBoardFilterOptions, LoginError } from './client';

describe('job board filters client (JOB-SRS-006, issue #46)', () => {
  const jsonResponse = (body: unknown, status: number) => ({
    ok: status < 400,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  });

  afterEach(() => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = globalThis.fetch;
  });

  it('builds repeat params for areaId/workTypeId and single params for the rest', async () => {
    const mock = jest.fn(async (url: string) => {
      const q = url.split('?')[1] ?? '';
      const params = new URLSearchParams(q);
      expect(params.get('projectId')).toBe('p-1');
      expect(params.getAll('areaId')).toEqual(['a-1', 'a-2']);
      expect(params.getAll('workTypeId')).toEqual(['w-1', 'w-2']);
      expect(params.get('skill')).toBe('mine');
      expect(params.get('dateFrom')).toBe('2026-02-10T00:00:00+07:00');
      expect(params.get('dateTo')).toBe('2026-02-20T00:00:00+07:00');
      return jsonResponse({ data: [], total: 0, limit: 20, offset: 0 }, 200);
    });
    // eslint-disable-next-line no-native-reassign
    global.fetch = mock as unknown as typeof fetch;

    await fetchJobBoard('tok-1', {
      limit: 20,
      offset: 0,
      projectId: 'p-1',
      areaIds: ['a-1', 'a-2'],
      workTypeIds: ['w-1', 'w-2'],
      dateFrom: '2026-02-10T00:00:00+07:00',
      dateTo: '2026-02-20T00:00:00+07:00',
      skill: 'mine',
    });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("treats '' as absent (no filter keys sent)", async () => {
    const mock = jest.fn(async (url: string) => {
      expect(url).toBe('http://localhost:3000/api/v1/job-board');
      return jsonResponse({ data: [], total: 0, limit: 20, offset: 0 }, 200);
    });
    // eslint-disable-next-line no-native-reassign
    global.fetch = mock as unknown as typeof fetch;

    await fetchJobBoard('tok-1', {
      projectId: '', dateFrom: '', dateTo: '', areaIds: [], workTypeIds: [],
    });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('fetchJobBoardFilterOptions 200: GETs /filter-options with no-store and maps {now, 4 arrays}', async () => {
    const body = {
      now: '2026-11-01T08:00:00.000Z',
      projects: [{ id: 'p-1', name: 'PRA' }],
      areas: [{ id: 'a-1', name: 'KQ01' }],
      workTypes: [{ id: 'w-1', name: 'BTCT' }],
      trades: [{ id: 't-1', name: 'Thợ cát' }],
    };
    const mock = jest.fn(async (url: string, init?: { cache?: string; headers?: Record<string, string> }) => {
      expect(url).toBe('http://localhost:3000/api/v1/job-board/filter-options');
      expect(init?.cache).toBe('no-store');
      expect(init?.headers?.Authorization).toBe('Bearer tok-1');
      return jsonResponse(body, 200);
    });
    // eslint-disable-next-line no-native-reassign
    global.fetch = mock as unknown as typeof fetch;

    const out = await fetchJobBoardFilterOptions('tok-1');
    expect(out).toEqual(body);
  });

  it('fetchJobBoardFilterOptions 200 thiếu now → 500 shape (F002 contract {now, 4 arrays})', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () =>
      jsonResponse({ projects: [], areas: [], workTypes: [], trades: [] }, 200),
    ) as unknown as typeof fetch;

    await expect(fetchJobBoardFilterOptions('tok-1')).rejects.toMatchObject({
      name: 'LoginError',
      status: 500,
    });
  });

  it('fetchJobBoardFilterOptions 401: keeps the session-dead kind', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () =>
      jsonResponse({ message: 'Unauthorized', statusCode: 401 }, 401),
    ) as unknown as typeof fetch;

    await expect(fetchJobBoardFilterOptions('tok-1')).rejects.toMatchObject({
      name: 'LoginError',
      status: 401,
    });
  });

  it('fetchJobBoard 400 filter error: forwards fieldErrors + code (dateFrom naive)', async () => {
    // eslint-disable-next-line no-native-reassign
    global.fetch = jest.fn(async () =>
      jsonResponse(
        {
          statusCode: 400,
          message: 'Ngày giờ phải kèm múi giờ',
          code: 'JOB_BOARD_DATE_RANGE_INVALID',
          fieldErrors: { dateFrom: ['Ngày giờ phải kèm múi giờ'] },
        },
        400,
      ),
    ) as unknown as typeof fetch;

    const err: LoginError = await fetchJobBoard('tok-1', { dateFrom: '2026-01-01T00:00:00' }).catch((e) => e);
    expect(err).toBeInstanceOf(LoginError);
    expect(err.code).toBe('JOB_BOARD_DATE_RANGE_INVALID');
    expect(err.fieldErrors).toEqual({ dateFrom: ['Ngày giờ phải kèm múi giờ'] });
  });
});
