import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { WorkOrderPreviewScreen } from './WorkOrderPreviewScreen';
import * as client from '../../api/client';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

const previewFixture = {
  id: 'wo-1',
  code: 'WO-001',
  title: 'Thi công dầm sàn tầng 3',
  projectId: '22222222-2222-4222-8222-222222222222',
  projectName: 'Dự án A',
  status: 'OPEN',
  priority: 'HIGH',
  plannedStartAt: null,
  plannedEndAt: null,
  version: 3,
  jobBoard: { open: true, openFrom: null, openUntil: null, state: 'AVAILABLE' as const },
};

const CLAIM_LABEL = ['Nhận', 'việc'].join(' '); // assert absence without self-matching a source grep

describe('WorkOrderPreviewScreen (JOB-SRS-005, issue #45)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loading: shows the activity indicator while fetching', () => {
    jest.spyOn(client, 'fetchWorkOrderPreview').mockImplementation(() => new Promise(() => undefined));
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    expect(screen.getByLabelText('work order preview loading indicator')).toBeTruthy();
  });

  it('AVAILABLE: renders fields with no banner and no claim action', async () => {
    jest.spyOn(client, 'fetchWorkOrderPreview').mockResolvedValueOnce(previewFixture);
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    expect(await screen.findByText('Thi công dầm sàn tầng 3')).toBeTruthy();
    expect(screen.getByText('WO-001')).toBeTruthy();
    expect(screen.queryByLabelText('non-available banner')).toBeNull();
    expect(screen.queryByText(CLAIM_LABEL)).toBeNull();
  });

  it('non-AVAILABLE: shows the status banner and still no claim action', async () => {
    jest.spyOn(client, 'fetchWorkOrderPreview').mockResolvedValueOnce({
      ...previewFixture,
      jobBoard: { ...previewFixture.jobBoard, state: 'ASSIGNED' as const },
    });
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    expect(await screen.findByLabelText('non-available banner')).toBeTruthy();
    expect(screen.queryByText(CLAIM_LABEL)).toBeNull();
  });

  it('401: re-login hint with a back-to-login action', async () => {
    jest.spyOn(client, 'fetchWorkOrderPreview').mockRejectedValueOnce(
      new client.LoginError('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại', 401),
    );
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    expect(await screen.findByText('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại')).toBeTruthy();
    expect(screen.getByLabelText('go to login')).toBeTruthy();
  });

  it('error + retry: alert banner and retry re-fetches', async () => {
    const previewSpy = jest.spyOn(client, 'fetchWorkOrderPreview')
      .mockRejectedValueOnce(new client.LoginError('Lỗi mạng', 0))
      .mockResolvedValueOnce(previewFixture);
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    expect(await screen.findByLabelText('work order preview error')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('retry work order preview'));
    expect(await screen.findByText('Thi công dầm sàn tầng 3')).toBeTruthy();
    expect(previewSpy).toHaveBeenCalledTimes(2);
  });

  it('F013 404: "công việc không còn" banner with a back action (no retry)', async () => {
    jest.spyOn(client, 'fetchWorkOrderPreview').mockRejectedValueOnce(
      new client.LoginError('Not Found', 404),
    );
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    expect(await screen.findByLabelText('work order gone')).toBeTruthy();
    expect(screen.getByText(/Công việc không còn/)).toBeTruthy();
    expect(screen.getByLabelText('back to job board')).toBeTruthy();
    expect(screen.queryByLabelText('retry work order preview')).toBeNull();
  });

  it('F013 null-state: loaded without data shows a banner distinct from loading', async () => {
    jest.spyOn(client, 'fetchWorkOrderPreview').mockResolvedValueOnce(null as never);
    render(<WorkOrderPreviewScreen token="tok-1" workOrderId="wo-1" />);
    expect(await screen.findByLabelText('no work order data')).toBeTruthy();
    expect(screen.getByLabelText('back to job board')).toBeTruthy();
    expect(screen.queryByLabelText('work order preview loading indicator')).toBeNull();
  });
});
