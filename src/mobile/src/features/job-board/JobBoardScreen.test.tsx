import React from 'react';
import { FlatList } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { JobBoardScreen } from './JobBoardScreen';
import * as client from '../../api/client';

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

const CLAIM_LABEL = ['Nhận', 'việc'].join(' '); // assert absence without self-matching a source grep

describe('JobBoardScreen (JOB-SRS-005, issue #45)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loading: shows the activity indicator while fetching', () => {
    jest.spyOn(client, 'fetchJobBoard').mockImplementation(() => new Promise(() => undefined));
    render(<JobBoardScreen token="tok-1" />);
    expect(screen.getByLabelText('job board loading indicator')).toBeTruthy();
  });

  it('list: renders code, title, project and the AVAILABLE badge', async () => {
    jest.spyOn(client, 'fetchJobBoard').mockResolvedValueOnce({ data: [item('WO-001')], total: 1, limit: 20, offset: 0 });
    render(<JobBoardScreen token="tok-1" />);
    expect(await screen.findByText('Việc WO-001')).toBeTruthy();
    expect(screen.getByText('WO-001')).toBeTruthy();
    expect(screen.getByLabelText('job state AVAILABLE')).toBeTruthy();
  });

  it('never renders a claim action in any state', async () => {
    jest.spyOn(client, 'fetchJobBoard').mockResolvedValueOnce({ data: [item('WO-001')], total: 1, limit: 20, offset: 0 });
    render(<JobBoardScreen token="tok-1" />);
    expect(await screen.findByText('Việc WO-001')).toBeTruthy();
    expect(screen.queryByText(CLAIM_LABEL)).toBeNull();
  });

  it('empty: guidance copy with retry', async () => {
    jest.spyOn(client, 'fetchJobBoard').mockResolvedValueOnce({ data: [], total: 0, limit: 20, offset: 0 });
    render(<JobBoardScreen token="tok-1" />);
    expect(await screen.findByLabelText('no jobs')).toBeTruthy();
    expect(screen.getByText('Chưa có việc nào đang nhận — kéo xuống để làm mới')).toBeTruthy();
    expect(screen.getByLabelText('retry job board')).toBeTruthy();
  });

  it('401: re-login hint with a back-to-login action', async () => {
    jest.spyOn(client, 'fetchJobBoard').mockRejectedValueOnce(
      new client.LoginError('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại', 401),
    );
    render(<JobBoardScreen token="tok-1" />);
    expect(await screen.findByText('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại')).toBeTruthy();
    expect(screen.getByLabelText('go to login')).toBeTruthy();
  });

  it('error + retry: alert banner and retry re-fetches', async () => {
    const fetchSpy = jest.spyOn(client, 'fetchJobBoard')
      .mockRejectedValueOnce(new client.LoginError('Lỗi mạng', 0))
      .mockResolvedValueOnce({ data: [item('WO-001')], total: 1, limit: 20, offset: 0 });
    render(<JobBoardScreen token="tok-1" />);
    expect(await screen.findByLabelText('job board error')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('retry job board'));
    expect(await screen.findByText('Việc WO-001')).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('pagination: "Tải thêm" appends page 2 and stops when loaded === total', async () => {
    const fetchSpy = jest.spyOn(client, 'fetchJobBoard')
      .mockResolvedValueOnce({ data: [item('WO-001')], total: 2, limit: 20, offset: 0 })
      .mockResolvedValueOnce({ data: [item('WO-002')], total: 2, limit: 20, offset: 1 });
    render(<JobBoardScreen token="tok-1" />);
    expect(await screen.findByText('Việc WO-001')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('load more jobs'));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    expect(fetchSpy.mock.calls[1][1]).toMatchObject({ offset: 1 });
    expect(await screen.findByText('Việc WO-002')).toBeTruthy();
    expect(screen.getByText('Việc WO-001')).toBeTruthy();
    await waitFor(() => expect(screen.queryByLabelText('load more jobs')).toBeNull());
  });

  it('pull-to-refresh: refetches from offset 0 so a claimed item disappears', async () => {
    const fetchSpy = jest.spyOn(client, 'fetchJobBoard')
      .mockResolvedValueOnce({ data: [item('WO-001'), item('WO-002')], total: 2, limit: 20, offset: 0 })
      .mockResolvedValueOnce({ data: [item('WO-002')], total: 1, limit: 20, offset: 0 });
    render(<JobBoardScreen token="tok-1" />);
    expect(await screen.findByText('Việc WO-001')).toBeTruthy();
    const list = screen.UNSAFE_getByType(FlatList);
    const refresh = list.props.refreshControl as { props: { onRefresh: () => void } };
    await act(async () => { refresh.props.onRefresh(); });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    expect(fetchSpy.mock.calls[1][1]).toMatchObject({ offset: 0 });
    await waitFor(() => expect(screen.queryByText('Việc WO-001')).toBeNull());
    expect(screen.getByText('Việc WO-002')).toBeTruthy();
  });

  it('non-AVAILABLE item in payload: still no claim action (banner lives on the preview screen)', async () => {
    const assigned = { ...item('WO-009'), jobBoard: { open: true, openFrom: null, openUntil: null, state: 'ASSIGNED' as const } };
    jest.spyOn(client, 'fetchJobBoard').mockResolvedValueOnce({ data: [assigned], total: 1, limit: 20, offset: 0 });
    render(<JobBoardScreen token="tok-1" />);
    expect(await screen.findByLabelText('job state ASSIGNED')).toBeTruthy();
    expect(screen.queryByText(CLAIM_LABEL)).toBeNull();
  });

  it('F011: load-more failure keeps the list and shows a footer error with retry', async () => {
    const fetchSpy = jest.spyOn(client, 'fetchJobBoard')
      .mockResolvedValueOnce({ data: [item('WO-001')], total: 2, limit: 20, offset: 0 })
      .mockRejectedValueOnce(new client.LoginError('Lỗi mạng', 0))
      .mockResolvedValueOnce({ data: [item('WO-002')], total: 2, limit: 20, offset: 1 });
    render(<JobBoardScreen token="tok-1" />);
    expect(await screen.findByText('Việc WO-001')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('load more jobs'));
    expect(await screen.findByLabelText('load more error')).toBeTruthy();
    expect(screen.getByText('Việc WO-001')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('retry load more'));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(3));
    expect(await screen.findByText('Việc WO-002')).toBeTruthy();
    expect(screen.getByText('Việc WO-001')).toBeTruthy();
  });

  it('F012: refresh failure keeps the current list and shows a banner instead of wiping', async () => {
    const fetchSpy = jest.spyOn(client, 'fetchJobBoard')
      .mockResolvedValueOnce({ data: [item('WO-001')], total: 1, limit: 20, offset: 0 })
      .mockRejectedValueOnce(new client.LoginError('Lỗi mạng', 0));
    render(<JobBoardScreen token="tok-1" />);
    expect(await screen.findByText('Việc WO-001')).toBeTruthy();
    const list = screen.UNSAFE_getByType(FlatList);
    const refresh = list.props.refreshControl as { props: { onRefresh: () => void } };
    await act(async () => { refresh.props.onRefresh(); });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    expect(await screen.findByLabelText('refresh error')).toBeTruthy();
    expect(screen.getByText('Việc WO-001')).toBeTruthy();
    expect(screen.queryByLabelText('job board error')).toBeNull();
  });

  it('F012: "Tải thêm" is disabled while a refresh is in flight', async () => {
    const fetchSpy = jest.spyOn(client, 'fetchJobBoard')
      .mockResolvedValueOnce({ data: [item('WO-001')], total: 2, limit: 20, offset: 0 })
      .mockImplementationOnce(() => new Promise(() => undefined));
    render(<JobBoardScreen token="tok-1" />);
    expect(await screen.findByText('Việc WO-001')).toBeTruthy();
    const list = screen.UNSAFE_getByType(FlatList);
    const refresh = list.props.refreshControl as { props: { onRefresh: () => void } };
    await act(async () => { refresh.props.onRefresh(); });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText('load more jobs').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(screen.getByLabelText('load more jobs'));
    await act(async () => { await Promise.resolve(); });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
