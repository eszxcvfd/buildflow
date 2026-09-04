import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { LoginScreen } from './LoginScreen';
import * as client from '../../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('LoginScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('shows field validation errors when submitting empty form', async () => {
    render(<LoginScreen />);
    await waitFor(() => expect(screen.queryByLabelText('session loading indicator')).toBeNull());
    fireEvent.press(screen.getByLabelText('login submit'));
    expect(screen.getByText('Email không được để trống')).toBeTruthy();
    expect(screen.getByText('Mật khẩu không được để trống')).toBeTruthy();
  });

  it('renders session view after successful login', async () => {
    jest.spyOn(client, 'loginRequest').mockResolvedValueOnce({
      accessToken: 'token-123',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      user: { id: 'u1', email: 'e2e@example.com', fullName: 'E2E User', status: 'ACTIVE', userType: 'STAFF' },
      roles: [{ id: 'r1', code: 'WORKER', name: 'Worker' }],
      projectIds: [],
    });
    render(<LoginScreen />);
    await waitFor(() => expect(screen.queryByLabelText('session loading indicator')).toBeNull());

    fireEvent.changeText(screen.getByLabelText('email input'), 'e2e@example.com');
    fireEvent.changeText(screen.getByLabelText('password input'), 'Password123!');
    fireEvent.press(screen.getByLabelText('login submit'));

    await waitFor(() => expect(screen.getByText('Xin chào, E2E User')).toBeTruthy());
    expect(screen.getByLabelText('logout')).toBeTruthy();
  });

  it('calls server logout then clears session when pressing logout', async () => {
    jest.spyOn(client, 'loginRequest').mockResolvedValueOnce({
      accessToken: 'token-123',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      user: { id: 'u1', email: 'e2e@example.com', fullName: 'E2E User', status: 'ACTIVE', userType: 'STAFF' },
      roles: [{ id: 'r1', code: 'WORKER', name: 'Worker' }],
      projectIds: [],
    });
    const logoutSpy = jest.spyOn(client, 'logoutRequest').mockResolvedValueOnce();
    render(<LoginScreen />);
    await waitFor(() => expect(screen.queryByLabelText('session loading indicator')).toBeNull());
    fireEvent.changeText(screen.getByLabelText('email input'), 'e2e@example.com');
    fireEvent.changeText(screen.getByLabelText('password input'), 'Password123!');
    fireEvent.press(screen.getByLabelText('login submit'));
    await waitFor(() => expect(screen.getByText('Xin chào, E2E User')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('logout'));
    await waitFor(() => expect(logoutSpy).toHaveBeenCalledWith('token-123'));
    await waitFor(() => expect(screen.getByRole('header', { name: 'Đăng nhập' })).toBeTruthy());
  });

  it('keeps session view and shows error when logout API fails (network)', async () => {
    jest.spyOn(client, 'loginRequest').mockResolvedValueOnce({
      accessToken: 'token-123',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      user: { id: 'u1', email: 'e2e@example.com', fullName: 'E2E User', status: 'ACTIVE', userType: 'STAFF' },
      roles: [{ id: 'r1', code: 'WORKER', name: 'Worker' }],
      projectIds: [],
    });
    jest.spyOn(client, 'logoutRequest').mockRejectedValueOnce(new Error('network down'));
    render(<LoginScreen />);
    await waitFor(() => expect(screen.queryByLabelText('session loading indicator')).toBeNull());
    fireEvent.changeText(screen.getByLabelText('email input'), 'e2e@example.com');
    fireEvent.changeText(screen.getByLabelText('password input'), 'Password123!');
    fireEvent.press(screen.getByLabelText('login submit'));
    await waitFor(() => expect(screen.getByText('Xin chào, E2E User')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('logout'));
    await waitFor(() => expect(screen.getByText(/không thể kết nối/i)).toBeTruthy());
    expect(screen.getByText('Xin chào, E2E User')).toBeTruthy();
  });
});
