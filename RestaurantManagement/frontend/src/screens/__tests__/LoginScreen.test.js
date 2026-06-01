import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../LoginScreen';
import { getLoginProfiles } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

jest.mock('../../api/client', () => ({
  getLoginProfiles: jest.fn(),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => children,
}));

jest.spyOn(Alert, 'alert');

describe('LoginScreen', () => {
  const mockLogin = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    useAuth.mockReturnValue({
      login: mockLogin,
    });
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  it('loads saved email and login profiles, and allows successful login', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce('saved@test.com');
    const profiles = [{ id: 1, name: 'Alex Chef', email: 'alex@test.com', role: 'kitchen' }];
    getLoginProfiles.mockResolvedValueOnce({ data: { profiles } });
    mockLogin.mockResolvedValueOnce({});

    render(<LoginScreen />);

    // Check loading saved email
    await waitFor(() => {
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('lastLoginEmail');
    });

    // Check profile loaded
    await waitFor(() => {
      expect(screen.getByText('Alex Chef')).toBeTruthy();
    });

    // Press profile card to autofill email
    fireEvent.press(screen.getByText('Alex Chef'));

    // Input password
    fireEvent.changeText(screen.getByPlaceholderText('PIN / Password'), 'password123');

    // Click Sign In
    fireEvent.press(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('alex@test.com', 'password123');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('lastLoginEmail', 'alex@test.com');
    });
  });

  it('validates empty inputs on manual sign-in', async () => {
    getLoginProfiles.mockResolvedValueOnce({ data: { profiles: [] } });

    render(<LoginScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Loading profiles…')).toBeNull();
    });

    // Click Sign In with empty fields
    fireEvent.press(screen.getByText('Sign In'));

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please enter your email and password');
  });

  it('handles manual sign-in failure with Alert', async () => {
    getLoginProfiles.mockResolvedValueOnce({ data: { profiles: [] } });
    mockLogin.mockRejectedValueOnce({
      response: { data: { error: 'Invalid PIN' } },
    });

    render(<LoginScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Loading profiles…')).toBeNull();
    });

    // Type email and password
    fireEvent.changeText(screen.getByPlaceholderText('Email Address'), 'wrong@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('PIN / Password'), 'pin123');

    fireEvent.press(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Login Failed', 'Invalid PIN');
    });
  });

  it('handles profiles loading error gracefully', async () => {
    getLoginProfiles.mockRejectedValueOnce(new Error('Net error'));

    render(<LoginScreen />);

    await waitFor(() => {
      expect(screen.getByText(/could not load/i)).toBeTruthy();
    });
  });
});
