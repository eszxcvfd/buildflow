import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { JobBoardCard } from './JobBoardCard';
import type { JobBoardItem } from '../../api/client';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

const itemFixture: JobBoardItem = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'WO-001',
  title: 'Thi công dầm sàn tầng 3',
  projectId: '22222222-2222-4222-8222-222222222222',
  projectName: 'Dự án A',
  areaId: 'area-1',
  areaName: 'Khu KQ-01',
  workTypeId: '33333333-3333-4333-8333-333333333333',
  workTypeName: 'Bê tông',
  requiredTradeId: 'trade-1',
  requiredTradeName: 'Thợ cắt',
  priority: 'HIGH',
  plannedStartAt: '2026-09-01T00:00:00.000Z',
  plannedEndAt: '2026-09-10T00:00:00.000Z',
  plannedHeadcount: 5,
  version: 1,
  jobBoard: { open: true, openFrom: null, openUntil: null, state: 'AVAILABLE' },
};

const CLAIM_LABEL = ['Nhận', 'việc'].join(' '); // assert absence without self-matching a source grep

describe('JobBoardCard (JOB-SRS-005, issue #45)', () => {
  it('renders code, title, project, type, area, trade, priority and the AVAILABLE badge', () => {
    render(<JobBoardCard item={itemFixture} />);
    expect(screen.getByText('WO-001')).toBeTruthy();
    expect(screen.getByText('Thi công dầm sàn tầng 3')).toBeTruthy();
    expect(screen.getByText('Dự án: Dự án A')).toBeTruthy();
    expect(screen.getByText('Loại việc: Bê tông')).toBeTruthy();
    expect(screen.getByText('Khu vực: Khu KQ-01')).toBeTruthy();
    expect(screen.getByText('Kỹ năng: Thợ cắt')).toBeTruthy();
    expect(screen.getByText('Ưu tiên: HIGH')).toBeTruthy();
    expect(screen.getByLabelText('job state AVAILABLE')).toBeTruthy();
  });

  it('CTA is "Xem chi tiết" and never a claim action', () => {
    render(<JobBoardCard item={itemFixture} />);
    expect(screen.getByLabelText('view detail WO-001')).toBeTruthy();
    expect(screen.getByText('Xem chi tiết')).toBeTruthy();
    expect(screen.queryByText(CLAIM_LABEL)).toBeNull();
  });

  it('non-AVAILABLE item still shows no claim action, only the state badge', () => {
    render(<JobBoardCard item={{ ...itemFixture, jobBoard: { ...itemFixture.jobBoard, state: 'ASSIGNED' } }} />);
    expect(screen.getByLabelText('job state ASSIGNED')).toBeTruthy();
    expect(screen.getByText('Xem chi tiết')).toBeTruthy();
    expect(screen.queryByText(CLAIM_LABEL)).toBeNull();
  });
});
