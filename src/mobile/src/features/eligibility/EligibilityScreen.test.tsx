import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { EligibilityScreen } from './EligibilityScreen';
import * as client from '../../api/client';
import type { MyEligibility } from '../../api/client';

const baseFixture: MyEligibility = {
  resourceType: 'WORKER',
  resourceId: 'w1',
  eligible: true,
  checkedAt: '2026-09-06T10:00:00.000Z',
  correlationId: 'corr-123',
  conditions: [
    { code: 'RESOURCE_ACTIVE', passed: true, reasonCode: 'OK', detail: 'Tài khoản đang hoạt động' },
    { code: 'TRADE_SKILL_MATCH', passed: false, reasonCode: 'SKILL_LEVEL_TOO_LOW', detail: 'Bậc kỹ năng chưa đạt' },
    { code: 'TRADE_CAPABILITY_DATA', passed: true, reasonCode: 'OK', detail: 'Có dữ liệu năng lực' },
    { code: 'WORKLOAD', passed: true, reasonCode: 'OK', detail: 'Đang có 0 việc mở' },
    { code: 'SCHEDULE_CONFLICT', passed: null, reasonCode: 'NOT_EVALUABLE', detail: 'Chưa đánh giá lịch ở slice này' },
  ],
  crews: [
    { crewId: 'c1', crewCode: 'DOI-01', crewName: 'Đội 1', memberRole: 'MEMBER', effectiveFrom: '2026-01-01', effectiveTo: null },
    { crewId: 'c2', crewCode: 'DOI-02', crewName: 'Đội 2', memberRole: 'LEAD', effectiveFrom: '2026-02-01', effectiveTo: '2026-12-31' },
  ],
};

describe('EligibilityScreen (ORG-SRS-008, issue #31)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loading: shows the activity indicator while fetching', () => {
    jest.spyOn(client, 'fetchMyEligibility').mockImplementation(() => new Promise(() => undefined));
    render(<EligibilityScreen token="tok-1" />);
    expect(screen.getByLabelText('eligibility loading indicator')).toBeTruthy();
  });

  it('eligible worker: verdict banner + per-condition badges incl. passed:null label + crews list', async () => {
    jest.spyOn(client, 'fetchMyEligibility').mockResolvedValueOnce({ ...baseFixture, eligible: true });
    render(<EligibilityScreen token="tok-1" />);

    expect(await screen.findByText('Đủ điều kiện nhận việc')).toBeTruthy();
    expect(screen.getByText('Mã đối chiếu: corr-123')).toBeTruthy();
    // true → ĐẠT, false → KHÔNG ĐẠT, null → KHÔNG ĐÁNH GIÁ ĐƯỢC
    expect(screen.getAllByText('ĐẠT').length).toBeGreaterThan(0);
    expect(screen.getByText('KHÔNG ĐẠT')).toBeTruthy();
    expect(screen.getByText('KHÔNG ĐÁNH GIÁ ĐƯỢC')).toBeTruthy();
    expect(screen.getByText('Chưa đánh giá lịch ở slice này')).toBeTruthy();
    // Crews membership section: mã · tên · vai trò · hiệu lực
    expect(screen.getByText('DOI-01 · Đội 1')).toBeTruthy();
    expect(screen.getByText(/Vai trò: MEMBER/)).toBeTruthy();
    expect(screen.getByText(/hiện tại/)).toBeTruthy();
    expect(screen.getByText('DOI-02 · Đội 2')).toBeTruthy();
  });

  it('ineligible worker: failure verdict', async () => {
    jest.spyOn(client, 'fetchMyEligibility').mockResolvedValueOnce({ ...baseFixture, eligible: false });
    render(<EligibilityScreen token="tok-1" />);
    expect(await screen.findByText('Chưa đủ điều kiện nhận việc')).toBeTruthy();
  });

  it('empty crews: renders the no-crew hint', async () => {
    jest.spyOn(client, 'fetchMyEligibility').mockResolvedValueOnce({ ...baseFixture, crews: [] });
    render(<EligibilityScreen token="tok-1" />);
    expect(await screen.findByText('Chưa thuộc đội nào')).toBeTruthy();
  });

  it('404 RESOURCE_NOT_FOUND: empty state without an alert banner', async () => {
    jest.spyOn(client, 'fetchMyEligibility').mockRejectedValueOnce(
      new client.LoginError('user không có hồ sơ worker', 404, 'RESOURCE_NOT_FOUND'),
    );
    render(<EligibilityScreen token="tok-1" />);
    expect(await screen.findByText('Tài khoản không có hồ sơ worker')).toBeTruthy();
    expect(screen.queryByRole?.('alert') ?? null).toBeNull();
  });

  it('401: re-login hint', async () => {
    jest.spyOn(client, 'fetchMyEligibility').mockRejectedValueOnce(
      new client.LoginError('Phiên đăng nhập đã hết hạn', 401),
    );
    render(<EligibilityScreen token="tok-1" />);
    expect(await screen.findByText('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại')).toBeTruthy();
  });

  it('generic error: message + Thử lại retries the fetch', async () => {
    const spy = jest.spyOn(client, 'fetchMyEligibility')
      .mockRejectedValueOnce(new client.LoginError('Không tải được điều kiện nhận việc (500)', 500))
      .mockResolvedValueOnce({ ...baseFixture, eligible: true });
    render(<EligibilityScreen token="tok-1" />);
    expect(await screen.findByText('Không tải được điều kiện nhận việc (500)')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('retry eligibility'));
    expect(await screen.findByText('Đủ điều kiện nhận việc')).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('refresh button re-fetches (stale → force refresh)', async () => {
    const spy = jest.spyOn(client, 'fetchMyEligibility').mockResolvedValue({ ...baseFixture, eligible: true });
    render(<EligibilityScreen token="tok-1" />);
    await screen.findByText('Đủ điều kiện nhận việc');

    fireEvent.press(screen.getByLabelText('refresh eligibility'));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
  });
});
