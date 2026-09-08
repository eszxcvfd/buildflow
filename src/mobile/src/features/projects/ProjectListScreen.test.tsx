import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ProjectListScreen } from './ProjectListScreen';
import * as client from '../../api/client';
import type { ProjectSummary } from '../../api/client';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

const projectFixture: ProjectSummary = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'PRJ-001',
  name: 'Dự án 1',
  status: 'ACTIVE',
  managerId: '22222222-2222-4222-8222-222222222222',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
};

describe('ProjectListScreen (PRJ-SRS-006, issue #37)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loading: shows the activity indicator while fetching', () => {
    jest.spyOn(client, 'listProjects').mockImplementation(() => new Promise(() => undefined));
    render(<ProjectListScreen token="tok-1" />);
    expect(screen.getByLabelText('projects loading indicator')).toBeTruthy();
  });

  it('list: renders name, code and status badge per project', async () => {
    jest.spyOn(client, 'listProjects').mockResolvedValueOnce([projectFixture]);
    render(<ProjectListScreen token="tok-1" />);
    expect(await screen.findByText('Dự án 1')).toBeTruthy();
    expect(screen.getByText('PRJ-001')).toBeTruthy();
    expect(screen.getByText('ACTIVE')).toBeTruthy();
  });

  it('empty: neutral empty state with retry', async () => {
    jest.spyOn(client, 'listProjects').mockResolvedValueOnce([]);
    render(<ProjectListScreen token="tok-1" />);
    expect(await screen.findByLabelText('no projects')).toBeTruthy();
    expect(screen.getByText('Bạn chưa là thành viên dự án nào')).toBeTruthy();
    expect(screen.getByLabelText('retry projects')).toBeTruthy();
  });

  it('401: re-login hint with a back-to-login action', async () => {
    jest.spyOn(client, 'listProjects').mockRejectedValueOnce(
      new client.LoginError('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại', 401),
    );
    render(<ProjectListScreen token="tok-1" />);
    expect(await screen.findByText('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại')).toBeTruthy();
    expect(screen.getByLabelText('go to login')).toBeTruthy();
  });

  it('error + retry: alert banner and retry re-fetches', async () => {
    const listSpy = jest.spyOn(client, 'listProjects')
      .mockRejectedValueOnce(new client.LoginError('Lỗi mạng', 0))
      .mockResolvedValueOnce([projectFixture]);
    render(<ProjectListScreen token="tok-1" />);
    expect(await screen.findByText('Lỗi mạng')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('retry projects'));
    expect(await screen.findByText('Dự án 1')).toBeTruthy();
    expect(listSpy).toHaveBeenCalledTimes(2);
  });
});
