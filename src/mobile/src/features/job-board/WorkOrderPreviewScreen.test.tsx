import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { WorkOrderPreviewScreen } from './WorkOrderPreviewScreen';
import * as client from '../../api/client';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  // useFocusEffect no-op trong test (không có navigation context) — mount
  // fetch đi qua useEffect; focus re-fetch phủ bởi driver real-DB (S7).
  useFocusEffect: jest.fn(),
}));

const detailFixture: client.JobBoardDetail = {
  id: 'wo-1',
  code: 'WO-001',
  title: 'Thi công dầm sàn tầng 3',
  status: 'OPEN',
  priority: 'HIGH',
  projectId: '22222222-2222-4222-8222-222222222222',
  projectName: 'Dự án A',
  areaId: 'area-1',
  areaName: 'Khu A',
  workTypeId: 'wt-1',
  workTypeName: 'Bê tông cốt thép',
  workTypeDescription: 'Thi công bê tông',
  workTypeRequiredFields: ['bản vẽ', 'biên bản'],
  workTypeGroup: 'BTCT',
  requiredTradeId: 'trade-1',
  requiredTradeName: 'Thợ cát',
  plannedStartAt: '2026-09-11T01:00:00.000Z',
  plannedEndAt: '2026-09-12T01:00:00.000Z',
  dueAt: '2026-09-13T01:00:00.000Z',
  plannedHeadcount: 5,
  jobBoard: { open: true, openFrom: '2026-09-10T00:00:00.000Z', openUntil: '2026-09-11T00:00:00.000Z', state: 'AVAILABLE' },
  description: 'Đổ bê tông dầm sàn',
  instructions: 'Rung kỹ, bảo dưỡng 7 ngày',
  customFields: { tang: 3 },
  checklists: [
    {
      id: 'cl-1', code: 'CLT-BT-COT', name: 'Nghiệm thu đổ bê tông', purpose: 'PRE_START',
      version: 1, description: null,
      items: [
        { sequenceNo: 1, title: 'Cốp pha kín khít', description: null, answerType: 'PASS_FAIL', isRequired: true, isBlocking: true, requiresPhoto: true, minValue: null, maxValue: null },
        { sequenceNo: 2, title: 'Độ sụt bê tông (cm)', description: null, answerType: 'NUMBER', isRequired: true, isBlocking: false, requiresPhoto: false, minValue: 10, maxValue: 18 },
      ],
    },
    {
      id: 'cl-2', code: 'CLT-ATLD-DV', name: 'An toàn lao động đầu ca', purpose: 'INSPECTION',
      version: 1, description: null,
      items: [
        { sequenceNo: 1, title: 'Đội mũ bảo hộ', description: null, answerType: 'YES_NO', isRequired: true, isBlocking: true, requiresPhoto: false, minValue: null, maxValue: null },
      ],
    },
  ],
  version: 3,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
};

const withState = (state: client.JobBoardState): client.JobBoardDetail => ({
  ...detailFixture,
  jobBoard: { ...detailFixture.jobBoard!, state },
});

describe('WorkOrderPreviewScreen detail (JOB-SRS-007, issue #47)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loading: shows the activity indicator while fetching', () => {
    jest.spyOn(client, 'fetchJobBoardDetail').mockImplementation(() => new Promise(() => undefined));
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    expect(screen.getByLabelText('work order preview loading indicator')).toBeTruthy();
  });

  it('AVAILABLE: renders every §3.1 section + claim CTA, no state banner', async () => {
    jest.spyOn(client, 'fetchJobBoardDetail').mockResolvedValueOnce(detailFixture);
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    expect(await screen.findByText('Thi công dầm sàn tầng 3')).toBeTruthy();
    expect(screen.getByText('WO-001')).toBeTruthy();
    // Thời gian + cửa sổ nhận việc.
    expect(screen.getByLabelText('detail planned start')).toBeTruthy();
    expect(screen.getByLabelText('detail claim window')).toBeTruthy();
    // Địa điểm.
    expect(screen.getByLabelText('detail project')).toBeTruthy();
    expect(screen.getByLabelText('detail area')).toBeTruthy();
    // Loại việc + required fields + trade.
    expect(screen.getByLabelText('detail work type')).toBeTruthy();
    expect(screen.getByLabelText('detail required fields')).toBeTruthy();
    expect(screen.getByLabelText('detail trade')).toBeTruthy();
    // Mô tả + hướng dẫn + custom.
    expect(screen.getByLabelText('detail description')).toBeTruthy();
    expect(screen.getByLabelText('detail instructions')).toBeTruthy();
    expect(screen.getByLabelText('custom field tang')).toBeTruthy();
    // Checklists: purpose grouping + badges.
    expect(screen.getByLabelText('checklist group PRE_START')).toBeTruthy();
    expect(screen.getByLabelText('checklist group INSPECTION')).toBeTruthy();
    expect(screen.getByLabelText('checklist CLT-BT-COT')).toBeTruthy();
    expect(screen.getByText(/Bắt buộc · Chặn · Cần ảnh/)).toBeTruthy();
    // CTA matrix: AVAILABLE → nút Nhận việc, không banner state.
    expect(screen.getByLabelText('claim job button')).toBeTruthy();
    expect(screen.queryByLabelText('state banner available')).toBeNull();
    expect(screen.queryByLabelText('claim placeholder hint')).toBeNull();
  });

  it('CTA press: re-fetch re-checks, still AVAILABLE → #48 hint, no claim command', async () => {
    const spy = jest.spyOn(client, 'fetchJobBoardDetail')
      .mockResolvedValueOnce(detailFixture)
      .mockResolvedValueOnce(detailFixture);
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    await screen.findByLabelText('claim job button');
    await act(async () => { fireEvent.press(screen.getByLabelText('claim job button')); });
    expect(await screen.findByLabelText('claim placeholder hint')).toBeTruthy();
    // KHÔNG action claim thật: chỉ 2 GET detail (mount + re-check), không POST.
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith('tok-1', 'wo-1');
  });

  it.each([
    ['SCHEDULED', 'state banner scheduled', 'Chưa tới thời điểm nhận việc'],
    ['EXPIRED', 'state banner expired', 'Cửa sổ nhận việc đã hết'],
    ['ASSIGNED', 'state banner assigned', 'đã có người nhận'],
    ['CLOSED', 'state banner closed', 'hiện không nhận'],
  ] as const)('%s: state banner + reason, CTA hidden', async (state, label, copy) => {
    jest.spyOn(client, 'fetchJobBoardDetail').mockResolvedValueOnce(withState(state));
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    expect(await screen.findByLabelText(label)).toBeTruthy();
    expect(screen.getByText(new RegExp(copy))).toBeTruthy();
    expect(screen.queryByLabelText('claim job button')).toBeNull();
    expect(screen.queryByLabelText('claim placeholder hint')).toBeNull();
  });

  it('state change mid-view: re-check AVAILABLE→ASSIGNED shows changed banner + CTA gone', async () => {
    jest.spyOn(client, 'fetchJobBoardDetail')
      .mockResolvedValueOnce(detailFixture)
      .mockResolvedValueOnce(withState('ASSIGNED'));
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    await screen.findByLabelText('claim job button');
    await act(async () => { fireEvent.press(screen.getByLabelText('claim job button')); });
    expect(await screen.findByLabelText('detail state changed')).toBeTruthy();
    expect(screen.getByLabelText('state banner assigned')).toBeTruthy();
    expect(screen.queryByLabelText('claim job button')).toBeNull();
    // Không gửi command cũ: chỉ GET re-check, không POST/claim.
    expect(jest.mocked(client.fetchJobBoardDetail)).toHaveBeenCalledTimes(2);
  });

  it('reload after state change: re-fetches, banner clears, data kept', async () => {
    jest.spyOn(client, 'fetchJobBoardDetail')
      .mockResolvedValueOnce(detailFixture)
      .mockResolvedValueOnce(withState('ASSIGNED'))
      .mockResolvedValueOnce(withState('ASSIGNED'));
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    await screen.findByLabelText('claim job button');
    await act(async () => { fireEvent.press(screen.getByLabelText('claim job button')); });
    await screen.findByLabelText('detail state changed');
    await act(async () => { fireEvent.press(screen.getByLabelText('reload detail')); });
    await act(async () => undefined);
    expect(screen.queryByLabelText('detail state changed')).toBeNull();
    // Data mới giữ trên màn hình (title vẫn đó), fetch lần 3 đã chạy.
    expect(screen.getByText('Thi công dầm sàn tầng 3')).toBeTruthy();
    expect(jest.mocked(client.fetchJobBoardDetail)).toHaveBeenCalledTimes(3);
  });

  it('pull-refresh: refetches and keeps old data on failure with inline banner', async () => {
    jest.spyOn(client, 'fetchJobBoardDetail')
      .mockResolvedValueOnce(detailFixture)
      .mockRejectedValueOnce(new client.LoginError('Lỗi mạng', 0));
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    await screen.findByText('Thi công dầm sàn tầng 3');
    const scroll = screen.getByLabelText('job board detail scroll');
    const refresh = scroll.props.refreshControl as { props: { onRefresh: () => void } };
    await act(async () => { refresh.props.onRefresh(); });
    expect(await screen.findByLabelText('refresh error')).toBeTruthy();
    // Data cũ giữ, CTA còn (không wipe như F012 #45).
    expect(screen.getByText('Thi công dầm sàn tầng 3')).toBeTruthy();
    expect(screen.getByLabelText('claim job button')).toBeTruthy();
    // Retry refresh thành công → banner mất.
    jest.mocked(client.fetchJobBoardDetail).mockResolvedValueOnce(detailFixture);
    await act(async () => { fireEvent.press(screen.getByLabelText('retry detail refresh')); });
    await act(async () => undefined);
    expect(screen.queryByLabelText('refresh error')).toBeNull();
  });

  it('overlapping refresh: second trigger while busy is ignored (no stacked requests)', async () => {
    let resolveSlow!: (v: client.JobBoardDetail) => void;
    const slow = new Promise<client.JobBoardDetail>((res) => { resolveSlow = res; });
    const spy = jest.spyOn(client, 'fetchJobBoardDetail')
      .mockResolvedValueOnce(detailFixture)
      .mockReturnValueOnce(slow);
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    await screen.findByText('Thi công dầm sàn tầng 3');
    const scroll = screen.getByLabelText('job board detail scroll');
    const refresh = scroll.props.refreshControl as { props: { onRefresh: () => void } };
    // Refresh 1 bắt đầu (in-flight) → refresh 2 ngay sau bị chặn (busy-guard R6).
    refresh.props.onRefresh();
    refresh.props.onRefresh();
    expect(spy).toHaveBeenCalledTimes(2); // mount + refresh 1 (không refresh 2)
    await act(async () => { resolveSlow(detailFixture); });
    expect(await screen.findByText('Thi công dầm sàn tầng 3')).toBeTruthy();
  });

  it('403: forbidden screen, detail cleared (no stale render)', async () => {
    jest.spyOn(client, 'fetchJobBoardDetail').mockRejectedValueOnce(
      new client.LoginError('Bạn không có quyền xem công việc này', 403),
    );
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    expect(await screen.findByLabelText('detail forbidden')).toBeTruthy();
    expect(screen.getByText(/không có quyền xem/)).toBeTruthy();
    expect(screen.getByLabelText('back to job board')).toBeTruthy();
    expect(screen.queryByLabelText('retry work order preview')).toBeNull();
  });

  it('403 on re-fetch: wipes rendered detail (AC-7)', async () => {
    jest.spyOn(client, 'fetchJobBoardDetail')
      .mockResolvedValueOnce(detailFixture)
      .mockRejectedValueOnce(new client.LoginError('Bạn không có quyền xem công việc này', 403));
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    await screen.findByText('Thi công dầm sàn tầng 3');
    const scroll = screen.getByLabelText('job board detail scroll');
    const refresh = scroll.props.refreshControl as { props: { onRefresh: () => void } };
    await act(async () => { refresh.props.onRefresh(); });
    expect(await screen.findByLabelText('detail forbidden')).toBeTruthy();
    expect(screen.queryByText('Thi công dầm sàn tầng 3')).toBeNull();
  });

  it('F001 refetch-404: mount AVAILABLE → refetch 404 → gone screen, CTA gone', async () => {
    jest.spyOn(client, 'fetchJobBoardDetail')
      .mockResolvedValueOnce(detailFixture)
      .mockRejectedValueOnce(new client.LoginError('Not Found', 404));
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    await screen.findByLabelText('claim job button');
    const scroll = screen.getByLabelText('job board detail scroll');
    const refresh = scroll.props.refreshControl as { props: { onRefresh: () => void } };
    await act(async () => { refresh.props.onRefresh(); });
    // Tái dùng gone screen (không keep-data), CTA Nhận việc biến mất.
    expect(await screen.findByLabelText('work order gone')).toBeTruthy();
    expect(screen.queryByText('Thi công dầm sàn tầng 3')).toBeNull();
    expect(screen.queryByLabelText('claim job button')).toBeNull();
    expect(screen.queryByLabelText('refresh error')).toBeNull();
  });

  it('F001 refetch-409: mount AVAILABLE → refetch 409 → config screen, CTA gone', async () => {
    jest.spyOn(client, 'fetchJobBoardDetail')
      .mockResolvedValueOnce(detailFixture)
      .mockRejectedValueOnce(new client.LoginError('Loại công việc không còn hợp lệ', 409, 'JOB_BOARD_CONFIG_INVALID'));
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    await screen.findByLabelText('claim job button');
    const scroll = screen.getByLabelText('job board detail scroll');
    const refresh = scroll.props.refreshControl as { props: { onRefresh: () => void } };
    await act(async () => { refresh.props.onRefresh(); });
    // Tái dùng config screen (giữ code), CTA Nhận việc biến mất.
    expect(await screen.findByLabelText('detail config error')).toBeTruthy();
    expect(screen.getByText(/Cấu hình công việc đang lỗi/)).toBeTruthy();
    expect(screen.queryByText('Thi công dầm sàn tầng 3')).toBeNull();
    expect(screen.queryByLabelText('claim job button')).toBeNull();
    expect(screen.queryByLabelText('refresh error')).toBeNull();
  });

  it('404: "công việc không còn" banner with a back action (no retry)', async () => {
    jest.spyOn(client, 'fetchJobBoardDetail').mockRejectedValueOnce(
      new client.LoginError('Not Found', 404),
    );
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    expect(await screen.findByLabelText('work order gone')).toBeTruthy();
    expect(screen.queryByLabelText('retry work order preview')).toBeNull();
  });

  it('409 config-invalid: config banner, no CTA, no misleading render', async () => {
    jest.spyOn(client, 'fetchJobBoardDetail').mockRejectedValueOnce(
      new client.LoginError('Loại công việc không còn hợp lệ', 409, 'JOB_BOARD_CONFIG_INVALID'),
    );
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    expect(await screen.findByLabelText('detail config error')).toBeTruthy();
    expect(screen.getByText(/Cấu hình công việc đang lỗi/)).toBeTruthy();
    expect(screen.queryByLabelText('claim job button')).toBeNull();
  });

  it('401: re-login hint with a back-to-login action', async () => {
    jest.spyOn(client, 'fetchJobBoardDetail').mockRejectedValueOnce(
      new client.LoginError('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại', 401),
    );
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    expect(await screen.findByText('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại')).toBeTruthy();
    expect(screen.getByLabelText('go to login')).toBeTruthy();
  });

  it('error + retry: alert banner and retry re-fetches', async () => {
    const spy = jest.spyOn(client, 'fetchJobBoardDetail')
      .mockRejectedValueOnce(new client.LoginError('Lỗi mạng', 0))
      .mockResolvedValueOnce(detailFixture);
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    expect(await screen.findByLabelText('work order preview error')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('retry work order preview'));
    expect(await screen.findByText('Thi công dầm sàn tầng 3')).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('empty checklists: configured-empty state (not a config error)', async () => {
    jest.spyOn(client, 'fetchJobBoardDetail').mockResolvedValueOnce({ ...detailFixture, checklists: [] });
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    expect(await screen.findByLabelText('detail checklists empty')).toBeTruthy();
    expect(screen.queryByLabelText('detail config error')).toBeNull();
  });

  it('F013 null-state: loaded without data shows a banner distinct from loading', async () => {
    jest.spyOn(client, 'fetchJobBoardDetail').mockResolvedValueOnce(null as never);
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    expect(await screen.findByLabelText('no work order data')).toBeTruthy();
    expect(screen.queryByLabelText('work order preview loading indicator')).toBeNull();
  });
});
