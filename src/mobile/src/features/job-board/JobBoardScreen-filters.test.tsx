import React from 'react';
import { FlatList } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { JobBoardScreen } from './JobBoardScreen';
import * as client from '../../api/client';
import { clearJobBoardFilter, setJobBoardFilter, getJobBoardFilter, resetJobBoardFilterBindingForTests } from './job-board-filter-state';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

const item = (code: string, id = code) => ({
  id,
  code,
  title: `Việc ${code}`,
  projectId: '22222222-2222-4222-8222-222222222222',
  projectName: 'Dự án A',
  areaId: null,
  areaName: null,
  workTypeId: '33333333-3333-4333-8333-333333333333',
  workTypeName: 'Bê tông',
  requiredTradeId: null,
  requiredTradeName: null,
  priority: 'MEDIUM',
  plannedStartAt: null,
  plannedEndAt: null,
  plannedHeadcount: null,
  version: 1,
  jobBoard: { open: true, openFrom: null, openUntil: null, state: 'AVAILABLE' as const },
});

const CLAIM_LABEL = ['Nhận', 'việc'].join(' ');

describe('JobBoardScreen with filters (JOB-SRS-006, issue #46)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearJobBoardFilter();
    resetJobBoardFilterBindingForTests();
    jest.spyOn(client, 'fetchJobBoardFilterOptions').mockResolvedValue({
      now: '2026-11-01T08:00:00.000Z',
      projects: [{ id: '22222222-2222-4222-8222-222222222222', name: 'Dự án A' }],
      areas: [],
      workTypes: [],
      trades: [],
    });
  });

  it('apply via sheet: fetches offset 0 with the filter params and shows active chips', async () => {
    const fetchSpy = jest.spyOn(client, 'fetchJobBoard')
      .mockResolvedValueOnce({ data: [item('WO-001')], total: 1, limit: 20, offset: 0 })
      .mockResolvedValueOnce({ data: [], total: 0, limit: 20, offset: 0 });
    render(<JobBoardScreen token="tok-1" />);
    expect(await screen.findByText('Việc WO-001')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('open job board filter'));
    fireEvent.changeText(screen.getByLabelText('filter date from input'), '2026-02-10T00:00:00+07:00');
    fireEvent.press(screen.getByLabelText('apply job board filter'));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    expect(fetchSpy.mock.calls[1][1]).toMatchObject({ offset: 0, dateFrom: '2026-02-10T00:00:00+07:00' });
    // Empty-filtered state: distinct copy + clear action, still no claim CTA.
    expect(await screen.findByLabelText('no jobs matching filter')).toBeTruthy();
    expect(screen.getByLabelText('clear all job board filters')).toBeTruthy();
    expect(screen.queryByText(CLAIM_LABEL)).toBeNull();
  });

  it('keeps the filter when remounting (back from detail) — store, not screen state', async () => {
    setJobBoardFilter({
      projectId: undefined, areaIds: [], workTypeIds: [],
      dateFrom: '2026-02-10T00:00:00+07:00', dateTo: undefined, skillMine: true,
    });
    const fetchSpy = jest.spyOn(client, 'fetchJobBoard')
      .mockResolvedValue({ data: [item('WO-001')], total: 1, limit: 20, offset: 0 });
    const first = render(<JobBoardScreen token="tok-1" />);
    expect(await screen.findByText('Việc WO-001')).toBeTruthy();
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ dateFrom: '2026-02-10T00:00:00+07:00', skill: 'mine' });
    first.unmount();
    render(<JobBoardScreen token="tok-1" />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    expect(fetchSpy.mock.calls[1][1]).toMatchObject({ dateFrom: '2026-02-10T00:00:00+07:00', skill: 'mine' });
  });

  it('stale-response-ignored: slow old response does not overwrite the newer filter result', async () => {
    let slowResolve!: (v: { data: ReturnType<typeof item>[]; total: number; limit: number; offset: number }) => void;
    const slow = new Promise<{ data: ReturnType<typeof item>[]; total: number; limit: number; offset: number }>((res) => { slowResolve = res; });
    const fetchSpy = jest.spyOn(client, 'fetchJobBoard')
      .mockResolvedValueOnce({ data: [item('WO-001')], total: 1, limit: 20, offset: 0 })
      .mockReturnValueOnce(slow)
      .mockResolvedValueOnce({ data: [item('WO-002')], total: 1, limit: 20, offset: 0 });
    render(<JobBoardScreen token="tok-1" />);
    expect(await screen.findByText('Việc WO-001')).toBeTruthy();
    // Trigger 1 (gen+1): refresh with the old filter — stays slow.
    const list = screen.UNSAFE_getByType(FlatList);
    const refresh = list.props.refreshControl as { props: { onRefresh: () => void } };
    await act(async () => { refresh.props.onRefresh(); });
    // Trigger 2 (gen+2): apply a new filter — resolves fast.
    fireEvent.press(screen.getByLabelText('open job board filter'));
    fireEvent.changeText(screen.getByLabelText('filter date to input'), '2026-02-20T00:00:00+07:00');
    fireEvent.press(screen.getByLabelText('apply job board filter'));
    expect(await screen.findByText('Việc WO-002')).toBeTruthy();
    // The stale refresh resolves last with a different item — must be ignored.
    await act(async () => { slowResolve({ data: [item('WO-003')], total: 1, limit: 20, offset: 0 }); });
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText('Việc WO-003')).toBeNull();
    expect(screen.getByText('Việc WO-002')).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('no-overlapping-requests: busy-guard blocks onEndReached while load-more is in flight', async () => {
    const fetchSpy = jest.spyOn(client, 'fetchJobBoard')
      .mockResolvedValueOnce({ data: [item('WO-001')], total: 3, limit: 20, offset: 0 })
      .mockImplementationOnce(() => new Promise(() => undefined));
    render(<JobBoardScreen token="tok-1" />);
    expect(await screen.findByText('Việc WO-001')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByLabelText('load more jobs')); });
    // While loading-more: button replaced by spinner; a second trigger is ignored.
    expect(screen.queryByLabelText('load more jobs')).toBeNull();
    expect(screen.getByLabelText('loading more jobs')).toBeTruthy();
    const list = screen.UNSAFE_getByType(FlatList);
    await act(async () => { list.props.onEndReached?.(); });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('empty-filtered is distinct from empty-board and clear-all refetches the baseline', async () => {
    setJobBoardFilter({
      projectId: undefined, areaIds: ['no-such-area'], workTypeIds: [],
      dateFrom: undefined, dateTo: undefined, skillMine: false,
    });
    const fetchSpy = jest.spyOn(client, 'fetchJobBoard')
      .mockResolvedValueOnce({ data: [], total: 0, limit: 20, offset: 0 })
      .mockResolvedValueOnce({ data: [item('WO-001')], total: 1, limit: 20, offset: 0 });
    render(<JobBoardScreen token="tok-1" />);
    expect(await screen.findByLabelText('no jobs matching filter')).toBeTruthy();
    expect(screen.getByText('Không có việc nào khớp bộ lọc — thử nới điều kiện hoặc xóa bộ lọc')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('clear all job board filters'));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    expect(fetchSpy.mock.calls[1][1]).not.toHaveProperty('areaIds');
    expect(await screen.findByText('Việc WO-001')).toBeTruthy();
  });

  it('403 out-of-scope: message + retry + clear-filter action', async () => {
    const fetchSpy = jest.spyOn(client, 'fetchJobBoard')
      .mockRejectedValueOnce(new client.LoginError('Bạn không có quyền xem bảng việc này', 403));
    render(<JobBoardScreen token="tok-1" />);
    expect(await screen.findByText('Bạn không có quyền xem bảng việc này')).toBeTruthy();
    expect(screen.getByLabelText('retry job board')).toBeTruthy();
    fetchSpy.mockResolvedValueOnce({ data: [item('WO-001')], total: 1, limit: 20, offset: 0 });
    fireEvent.press(screen.getByLabelText('retry job board'));
    expect(await screen.findByText('Việc WO-001')).toBeTruthy();
  });

  it('field-error-render: 400 fieldErrors are listed per field', async () => {
    jest.spyOn(client, 'fetchJobBoard').mockRejectedValueOnce(
      new client.LoginError('Ngày giờ phải kèm múi giờ', 400, 'JOB_BOARD_DATE_RANGE_INVALID', {
        dateFrom: ['Ngày giờ phải kèm múi giờ'],
      }),
    );
    render(<JobBoardScreen token="tok-1" />);
    expect(await screen.findByLabelText('job board error')).toBeTruthy();
    expect(screen.getByLabelText('field error dateFrom')).toBeTruthy();
  });

  it('F003/F009/F010: token change clears the store + resets list (no stale flash)', async () => {
    setJobBoardFilter({
      projectId: undefined, areaIds: [], workTypeIds: [],
      dateFrom: '2026-02-10T00:00:00+07:00', dateTo: undefined, skillMine: true,
    });
    const fetchSpy = jest.spyOn(client, 'fetchJobBoard')
      .mockResolvedValueOnce({ data: [item('WO-001')], total: 1, limit: 20, offset: 0 })
      .mockResolvedValueOnce({ data: [], total: 0, limit: 20, offset: 0 });
    const r = render(<JobBoardScreen token="tok-A" />);
    expect(await screen.findByText('Việc WO-001')).toBeTruthy();
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ dateFrom: '2026-02-10T00:00:00+07:00', skill: 'mine' });
    r.rerender(<JobBoardScreen token="tok-B" />);
    // Store rỗng + chips rỗng + list cũ biến ngay (không flash data user A).
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    expect(getJobBoardFilter().dateFrom).toBeUndefined();
    expect(getJobBoardFilter().skillMine).toBe(false);
    expect(fetchSpy.mock.calls[1][1]).not.toHaveProperty('dateFrom');
    expect(fetchSpy.mock.calls[1][1]).not.toHaveProperty('skill');
    expect(screen.queryByText('Việc WO-001')).toBeNull();
    expect(screen.queryByLabelText('no jobs matching filter')).toBeNull();
    expect(await screen.findByLabelText('no jobs')).toBeTruthy();
  });

  it('F004: filter fail with a populated list keeps the list + banner, retry keeps the filter', async () => {
    const fetchSpy = jest.spyOn(client, 'fetchJobBoard')
      .mockResolvedValueOnce({ data: [item('WO-001')], total: 1, limit: 20, offset: 0 })
      .mockRejectedValueOnce(new client.LoginError('Lỗi máy chủ', 500));
    render(<JobBoardScreen token="tok-1" />);
    expect(await screen.findByText('Việc WO-001')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('open job board filter'));
    fireEvent.changeText(screen.getByLabelText('filter date to input'), '2026-02-20T00:00:00+07:00');
    fireEvent.press(screen.getByLabelText('apply job board filter'));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    // List còn + banner lỗi (không wipe về error branch).
    expect(screen.getByText('Việc WO-001')).toBeTruthy();
    expect(screen.getByLabelText('refresh error')).toBeTruthy();
    expect(screen.queryByLabelText('job board error')).toBeNull();
    // Retry từ banner giữ filter hiện hành, offset 0.
    fetchSpy.mockResolvedValueOnce({ data: [item('WO-002')], total: 1, limit: 20, offset: 0 });
    fireEvent.press(screen.getByLabelText('retry job board refresh'));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3));
    expect(fetchSpy.mock.calls[2][1]).toMatchObject({ offset: 0, dateTo: '2026-02-20T00:00:00+07:00' });
    expect(await screen.findByText('Việc WO-002')).toBeTruthy();
    expect(screen.queryByLabelText('refresh error')).toBeNull();
  });

  it('F005: from the 403 branch the filter sheet opens (escape hatch)', async () => {
    jest.spyOn(client, 'fetchJobBoard')
      .mockRejectedValueOnce(new client.LoginError('Bạn không có quyền xem bảng việc này', 403));
    render(<JobBoardScreen token="tok-1" />);
    expect(await screen.findByText('Bạn không có quyền xem bảng việc này')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('open job board filter'));
    expect(await screen.findByLabelText('apply job board filter')).toBeTruthy();
  });

  it('F006: refresh-during-loadMore does not overlap', async () => {
    let moreResolve!: (v: { data: ReturnType<typeof item>[]; total: number; limit: number; offset: number }) => void;
    const more = new Promise<{ data: ReturnType<typeof item>[]; total: number; limit: number; offset: number }>((res) => { moreResolve = res; });
    const fetchSpy = jest.spyOn(client, 'fetchJobBoard')
      .mockResolvedValueOnce({ data: [item('WO-001')], total: 3, limit: 20, offset: 0 })
      .mockReturnValueOnce(more);
    render(<JobBoardScreen token="tok-1" />);
    expect(await screen.findByText('Việc WO-001')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByLabelText('load more jobs')); });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    // Refresh trong lúc load-more đang chạy → bị chặn.
    const list = screen.UNSAFE_getByType(FlatList);
    const refresh = list.props.refreshControl as { props: { onRefresh: () => void } };
    await act(async () => { refresh.props.onRefresh(); });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    await act(async () => { moreResolve({ data: [item('WO-002')], total: 3, limit: 20, offset: 1 }); });
    expect(await screen.findByText('Việc WO-002')).toBeTruthy();
  });

  it('F006: double retryMore while one is in flight sends a single request', async () => {
    let retryResolve!: (v: { data: ReturnType<typeof item>[]; total: number; limit: number; offset: number }) => void;
    const retryP = new Promise<{ data: ReturnType<typeof item>[]; total: number; limit: number; offset: number }>((res) => { retryResolve = res; });
    const fetchSpy = jest.spyOn(client, 'fetchJobBoard')
      .mockResolvedValueOnce({ data: [item('WO-001')], total: 3, limit: 20, offset: 0 })
      .mockRejectedValueOnce(new client.LoginError('Lỗi mạng', 0))
      .mockReturnValueOnce(retryP);
    render(<JobBoardScreen token="tok-1" />);
    expect(await screen.findByText('Việc WO-001')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByLabelText('load more jobs')); });
    expect(await screen.findByLabelText('load more error')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('retry load more'));
    expect(await screen.findByLabelText('loading more jobs')).toBeTruthy();
    // Nút retry đã thay bằng spinner — không còn đường bấm chồng.
    expect(screen.queryByLabelText('retry load more')).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    await act(async () => { retryResolve({ data: [item('WO-002')], total: 3, limit: 20, offset: 1 }); });
    expect(await screen.findByText('Việc WO-002')).toBeTruthy();
  });

  it('F007: stale initial (token cũ) về trước không tắt loading của token mới', async () => {
    type Page = { data: ReturnType<typeof item>[]; total: number; limit: number; offset: number };
    let resolveA!: (v: Page) => void;
    let resolveB!: (v: Page) => void;
    const slowA = new Promise<Page>((res) => { resolveA = res; });
    const slowB = new Promise<Page>((res) => { resolveB = res; });
    const fetchSpy = jest.spyOn(client, 'fetchJobBoard')
      .mockReturnValueOnce(slowA)
      .mockReturnValueOnce(slowB);
    const r = render(<JobBoardScreen token="tok-A" />);
    expect(screen.getByLabelText('job board loading indicator')).toBeTruthy();
    r.rerender(<JobBoardScreen token="tok-B" />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    // Token cũ (stale) về trước với data lạ → bị bỏ qua, loading còn.
    await act(async () => { resolveA({ data: [item('WO-001')], total: 1, limit: 20, offset: 0 }); });
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByLabelText('job board loading indicator')).toBeTruthy();
    expect(screen.queryByText('Việc WO-001')).toBeNull();
    // Token mới về → render data mới, hết loading.
    await act(async () => { resolveB({ data: [item('WO-002')], total: 1, limit: 20, offset: 0 }); });
    expect(await screen.findByText('Việc WO-002')).toBeTruthy();
    expect(screen.queryByText('Việc WO-001')).toBeNull();
  });

  it('refresh keeps the active filter (AC3 pin — F024b)', async () => {
    setJobBoardFilter({
      projectId: undefined, areaIds: [], workTypeIds: [],
      dateFrom: '2026-02-10T00:00:00+07:00', dateTo: undefined, skillMine: true,
    });
    const fetchSpy = jest.spyOn(client, 'fetchJobBoard')
      .mockResolvedValue({ data: [item('WO-001')], total: 1, limit: 20, offset: 0 });
    render(<JobBoardScreen token="tok-1" />);
    expect(await screen.findByText('Việc WO-001')).toBeTruthy();
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ dateFrom: '2026-02-10T00:00:00+07:00', skill: 'mine' });
    const list = screen.UNSAFE_getByType(FlatList);
    const refresh = list.props.refreshControl as { props: { onRefresh: () => void } };
    await act(async () => { refresh.props.onRefresh(); });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    expect(fetchSpy.mock.calls[1][1]).toMatchObject({ offset: 0, dateFrom: '2026-02-10T00:00:00+07:00', skill: 'mine' });
    expect(screen.getByText('Việc WO-001')).toBeTruthy();
  });
});
