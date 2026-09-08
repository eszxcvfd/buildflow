import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ProjectDetailScreen } from './ProjectDetailScreen';
import * as client from '../../api/client';
import type { ProjectSummary, ProjectMember } from '../../api/client';

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

const memberFixture: ProjectMember = {
  id: 'm1',
  userId: 'u1',
  userName: 'Nguyen Van A',
  userCode: 'NV-001',
  projectRole: 'WORKER',
  joinedAt: '2026-01-02T00:00:00.000Z',
  leftAt: null,
  isActive: true,
};

function mockSuccess(members: ProjectMember[] = [memberFixture]) {
  jest.spyOn(client, 'getProject').mockResolvedValueOnce(projectFixture);
  jest.spyOn(client, 'listProjectMembers').mockResolvedValueOnce(members);
}

describe('ProjectDetailScreen (PRJ-SRS-006, issue #37)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loading: shows the activity indicator while fetching', () => {
    jest.spyOn(client, 'getProject').mockImplementation(() => new Promise(() => undefined));
    jest.spyOn(client, 'listProjectMembers').mockImplementation(() => new Promise(() => undefined));
    render(<ProjectDetailScreen token="tok-1" projectId={projectFixture.id} />);
    expect(screen.getByLabelText('project detail loading indicator')).toBeTruthy();
  });

  it('detail + member list: renders basic info and teammates on 200', async () => {
    mockSuccess();
    render(<ProjectDetailScreen token="tok-1" projectId={projectFixture.id} />);
    expect(await screen.findByLabelText('project name')).toBeTruthy();
    expect(screen.getByLabelText('project code')).toBeTruthy();
    expect(screen.getByLabelText('project status')).toBeTruthy();
    expect(await screen.findByText('Nguyen Van A')).toBeTruthy();
    expect(screen.getByText(/Vai trò: WORKER/)).toBeTruthy();
  });

  it('403: out-of-scope notice with back-to-list, no project data leaked', async () => {
    jest.spyOn(client, 'getProject').mockRejectedValueOnce(
      new client.LoginError('Không có quyền truy cập dự án này', 403),
    );
    const membersSpy = jest.spyOn(client, 'listProjectMembers');
    render(<ProjectDetailScreen token="tok-1" projectId={projectFixture.id} />);
    expect(await screen.findByText('Bạn không phải thành viên dự án này (403)')).toBeTruthy();
    expect(screen.getByLabelText('back to projects')).toBeTruthy();
    // Anti-leak: members are never fetched when detail itself is out-of-scope.
    expect(membersSpy).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('project name')).toBeNull();
  });

  it('404: not-found notice with back-to-list', async () => {
    jest.spyOn(client, 'getProject').mockRejectedValueOnce(
      new client.LoginError('Không tìm thấy dự án', 404),
    );
    render(<ProjectDetailScreen token="tok-1" projectId={projectFixture.id} />);
    expect(await screen.findByText('Không tìm thấy dự án')).toBeTruthy();
    expect(screen.getByLabelText('back to projects')).toBeTruthy();
  });

  it('401: re-login hint', async () => {
    jest.spyOn(client, 'getProject').mockRejectedValueOnce(
      new client.LoginError('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại', 401),
    );
    render(<ProjectDetailScreen token="tok-1" projectId={projectFixture.id} />);
    expect(await screen.findByText('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại')).toBeTruthy();
    expect(screen.getByLabelText('go to login')).toBeTruthy();
  });

  it('members 403 after detail 200 (mid-flight revoke): inline notice + retry, detail intact', async () => {
    jest.spyOn(client, 'getProject').mockResolvedValueOnce(projectFixture);
    jest.spyOn(client, 'listProjectMembers').mockRejectedValueOnce(
      new client.LoginError('Không có quyền truy cập dự án này', 403),
    );
    render(<ProjectDetailScreen token="tok-1" projectId={projectFixture.id} />);
    expect(await screen.findByLabelText('project name')).toBeTruthy();
    expect(await screen.findByText('Bạn không còn quyền xem thành viên dự án này')).toBeTruthy();
    expect(screen.getByLabelText('retry project members')).toBeTruthy();
  });
});
