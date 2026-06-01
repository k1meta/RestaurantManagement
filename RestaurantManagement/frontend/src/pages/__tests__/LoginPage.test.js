/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '../LoginPage';
import { getLoginProfiles } from '../../api/client';

// Mock dependencies
jest.mock('../../api/client', () => ({
  getLoginProfiles: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

// Mock LanguageSwitcher
jest.mock('../../components/LanguageSwitcher', () => () => null);

describe('LoginPage', () => {
  const mockOnLogin = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
  });

  it('renders successfully and handles positive login path', async () => {
    // Arrange
    getLoginProfiles.mockResolvedValueOnce({
      data: { profiles: [{ id: 1, name: 'Alice Waiter', role: 'waiter', email: 'alice@test.com' }] },
    });
    mockOnLogin.mockResolvedValueOnce({ success: true });

    // Act
    render(<LoginPage onLogin={mockOnLogin} />);

    // Assert profiles loaded
    await waitFor(() => {
      expect(screen.getByText('Alice Waiter')).toBeDefined();
    });

    // Act - fill credentials from profile
    fireEvent.click(screen.getByText('Alice Waiter'));

    const emailInput = screen.getByPlaceholderText('emailPlaceholder');
    expect(emailInput.value).toBe('alice@test.com');

    // Act - type password and submit
    const passwordInput = screen.getByPlaceholderText('passwordPlaceholder');
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    fireEvent.click(screen.getByText('signIn'));

    // Assert login call
    await waitFor(() => {
      expect(mockOnLogin).toHaveBeenCalledWith('alice@test.com', 'password123');
    });

    // Assert local storage updated
    expect(localStorage.getItem('lastLoginEmail')).toBe('alice@test.com');
  });

  it('handles negative path: profile fetch error and login failure', async () => {
    // Arrange
    getLoginProfiles.mockRejectedValueOnce(new Error('Network error'));
    mockOnLogin.mockResolvedValueOnce({ success: false, error: 'Invalid credentials' });

    // Act
    render(<LoginPage onLogin={mockOnLogin} />);

    // Assert profile error is shown
    await waitFor(() => {
      expect(screen.getByText('profilesError')).toBeDefined();
    });

    // Act - manual input and submit
    const emailInput = screen.getByPlaceholderText('emailPlaceholder');
    const passwordInput = screen.getByPlaceholderText('passwordPlaceholder');

    fireEvent.change(emailInput, { target: { value: 'wrong@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByText('signIn'));

    // Assert login error is shown
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeDefined();
    });
  });
});
