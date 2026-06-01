/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OwnerDashboard from '../OwnerDashboard';
import {
  getLocations,
  getOrders,
  getSales,
  getMenu,
  getUsers,
  createLocation,
  createUser,
  deleteLocation,
  deleteUser,
  updateLocation,
  updateUser,
} from '../../api/client';
import useToast from '../../hooks/useToast';

// Mock dependencies
jest.mock('../../api/client', () => ({
  getLocations: jest.fn(),
  getOrders: jest.fn(),
  getSales: jest.fn(),
  getMenu: jest.fn(),
  getUsers: jest.fn(),
  createLocation: jest.fn(),
  createUser: jest.fn(),
  deleteLocation: jest.fn(),
  deleteUser: jest.fn(),
  updateLocation: jest.fn(),
  updateUser: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, options) => {
      if (options) {
        const parts = [key];
        const keys = Object.keys(options).sort();
        for (const k of keys) {
          parts.push(options[k]);
        }
        return parts.join('_');
      }
      return key;
    },
  }),
}));

jest.mock('../../hooks/useToast', () => jest.fn());
jest.mock('../../components/LanguageSwitcher', () => () => <div data-testid="language-switcher" />);
jest.mock('../../components/ToastContainer', () => () => <div data-testid="toast-container" />);

window.scrollTo = jest.fn();
const originalConfirm = window.confirm;

describe('OwnerDashboard', () => {
  const mockUser = { name: 'Owner Olivia', id: 5 };
  const mockOnLogout = jest.fn();
  const mockAddToast = jest.fn();

  const mockLocations = [
    { id: 1, name: 'Downtown', address: '123 Main St' },
    { id: 2, name: 'Uptown', address: '456 High St' },
  ];

  const mockUsers = [
    { id: 10, name: 'Manager Mike', email: 'mike@test.com', role: 'manager', location_id: 1 },
    { id: 11, name: 'Waiter Will', email: 'will@test.com', role: 'waiter', location_id: 2 },
  ];

  const mockOrders = [
    { id: 501, location_id: 1, status: 'pending', created_at: new Date().toISOString() },
    { id: 502, location_id: 2, status: 'closed', created_at: new Date().toISOString() },
  ];

  const mockSales = [
    { menu_item_id: 301, item_name: 'Burger', category: 'Food', location_id: 1, total_revenue: 100, total_sold: 10 },
    { menu_item_id: 302, item_name: 'Fries', category: 'Food', location_id: 2, total_revenue: 50, total_sold: 5 },
  ];

  const mockSummary = {
    total_revenue: 150,
    total_orders: 2,
    total_items_sold: 15,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    window.confirm = jest.fn(() => true);

    useToast.mockReturnValue({
      toasts: [],
      addToast: mockAddToast,
      removeToast: jest.fn(),
    });

    getLocations.mockResolvedValue({ data: { locations: mockLocations } });
    getOrders.mockResolvedValue({ data: { orders: mockOrders } });
    getSales.mockResolvedValue({ data: { sales: mockSales, summary: mockSummary } });
    getMenu.mockResolvedValue({ data: { menu: [] } });
    getUsers.mockResolvedValue({ data: { users: mockUsers } });
  });

  afterAll(() => {
    window.confirm = originalConfirm;
  });

  it('renders stats, locations, and staff lists successfully', async () => {
    render(<OwnerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.queryByText('loadingCommand')).not.toBeTruthy();
    });

    expect(getLocations).toHaveBeenCalled();
    expect(getSales).toHaveBeenCalledWith('monthly');

    expect(screen.getAllByDisplayValue(/Downtown/i).length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue(/Uptown/i).length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue('Manager Mike')).toBeTruthy();
    expect(screen.getByDisplayValue('Waiter Will')).toBeTruthy();
  });

  it('handles switching sales periods', async () => {
    render(<OwnerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.queryByText('loadingCommand')).not.toBeTruthy();
    });

    expect(getSales).toHaveBeenCalledWith('monthly');

    // Switch to weekly
    const weeklyButtons = screen.getAllByRole('button', { name: 'weekly' });
    fireEvent.click(weeklyButtons[0]);

    await waitFor(() => {
      expect(getSales).toHaveBeenCalledWith('weekly');
    });
  });

  it('allows focusing analytics on a specific location and clearing the filter', async () => {
    render(<OwnerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getAllByText('Downtown').length).toBeGreaterThan(0);
    });

    // Click on Downtown location card to focus filter (rendered in systemHealthNode button or card button)
    const downtownButtons = screen.getAllByRole('button');
    const dtBtn = downtownButtons.find(btn => btn.textContent.includes('Downtown'));
    fireEvent.click(dtBtn);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Focused analytics on Downtown.', 'success');
      expect(screen.getByText('locationFilter_Downtown')).toBeTruthy();
    });

    // Clear filter
    const clearButton = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Location filter cleared.', 'success');
    });
  });

  it('validates and creates a new location successfully', async () => {
    createLocation.mockResolvedValueOnce({ data: { location: { id: 3, name: 'Suburbs' } } });
    render(<OwnerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getAllByText('Downtown').length).toBeGreaterThan(0);
    });

    const addLocationButton = screen.getByRole('button', { name: 'addLocation' });
    
    // Validation failure
    fireEvent.click(addLocationButton);
    expect(mockAddToast).toHaveBeenCalledWith('Location name is required', 'error');

    // Fill fields and submit
    fireEvent.change(screen.getByPlaceholderText('locationNamePlaceholder'), { target: { value: 'Suburbs' } });
    fireEvent.change(screen.getByPlaceholderText('addressPlaceholder'), { target: { value: '789 Oak Rd' } });
    fireEvent.click(addLocationButton);

    await waitFor(() => {
      expect(createLocation).toHaveBeenCalledWith({ name: 'Suburbs', address: '789 Oak Rd' });
      expect(mockAddToast).toHaveBeenCalledWith('Location created successfully.', 'success');
    });
  });

  it('allows saving location draft updates', async () => {
    updateLocation.mockResolvedValueOnce({});
    render(<OwnerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getAllByText('Downtown').length).toBeGreaterThan(0);
    });

    const nameInputs = screen.getAllByRole('textbox');
    // Name inputs are in order: locationStudio name, locationStudio address, Downtown name, Downtown address, Uptown name, Uptown address, etc.
    // Let's modify Downtown name (value "Downtown", which is at index 2)
    fireEvent.change(nameInputs[2], { target: { value: 'Downtown Central' } });

    // Click Downtown save button (save buttons are labeled common:save or common:save_disabled)
    // Locations have save buttons. Let's find the save buttons.
    const saveButtons = screen.getAllByRole('button', { name: 'common:save' });
    fireEvent.click(saveButtons[0]); // first location save button

    await waitFor(() => {
      expect(updateLocation).toHaveBeenCalledWith(1, { name: 'Downtown Central', address: '123 Main St' });
      expect(mockAddToast).toHaveBeenCalledWith('Saved location Downtown.', 'success');
    });
  });

  it('allows deleting a location', async () => {
    deleteLocation.mockResolvedValueOnce({});
    render(<OwnerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getAllByText('Downtown').length).toBeGreaterThan(0);
    });

    const deleteButtons = screen.getAllByRole('button', { name: 'common:delete' });
    fireEvent.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(deleteLocation).toHaveBeenCalledWith(1);
      expect(mockAddToast).toHaveBeenCalledWith('Deleted location Downtown.', 'success');
    });
  });

  it('validates and creates a new user account successfully', async () => {
    createUser.mockResolvedValueOnce({ data: {} });
    render(<OwnerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Manager Mike')).toBeTruthy();
    });

    const createUserButton = screen.getByRole('button', { name: 'common:add' });

    // Validation failure (empty fields)
    fireEvent.click(createUserButton);
    expect(mockAddToast).toHaveBeenCalledWith('Name, email and password are required', 'error');

    // Fill fields
    fireEvent.change(screen.getByPlaceholderText('namePlaceholder'), { target: { value: 'Jane Owner' } });
    fireEvent.change(screen.getByPlaceholderText('emailPlaceholder'), { target: { value: 'jane@owner.com' } });
    fireEvent.change(screen.getByPlaceholderText('passwordPlaceholder'), { target: { value: 'pass123' } });
    
    // Select location
    const selectLocation = screen.getAllByRole('combobox')[1];
    fireEvent.change(selectLocation, { target: { value: '1' } });

    fireEvent.click(createUserButton);

    await waitFor(() => {
      expect(createUser).toHaveBeenCalledWith({
        name: 'Jane Owner',
        email: 'jane@owner.com',
        password: 'pass123',
        role: 'manager',
        location_id: 1,
      });
      expect(mockAddToast).toHaveBeenCalledWith('User created successfully.', 'success');
    });
  });

  it('allows updating user account details', async () => {
    updateUser.mockResolvedValueOnce({});
    render(<OwnerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Manager Mike')).toBeTruthy();
    });

    // Select input for Mike's name draft
    const nameInputs = screen.getAllByRole('textbox');
    // Downtown, Uptown, and user drafts. Let's find by value.
    const mikeInput = nameInputs.find(input => input.value === 'Manager Mike');
    fireEvent.change(mikeInput, { target: { value: 'Mike Manager' } });

    const userSaveButtons = screen.getAllByRole('button', { name: 'common:save' });
    // Save buttons: first ones are locations. The index of user save button:
    // Locations have save buttons. Let's find the one matching Mike (user id 10)
    // Actually, we can click the one next to Mike Manager's card
    // Let's click the user save button
    fireEvent.click(userSaveButtons[2]); // index 2 is user Mike Manager

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith(10, {
        name: 'Mike Manager',
        email: 'mike@test.com',
        role: 'manager',
        location_id: 1,
      });
      expect(mockAddToast).toHaveBeenCalledWith('Saved user Manager Mike.', 'success');
    });
  });

  it('allows deleting a user account', async () => {
    deleteUser.mockResolvedValueOnce({});
    render(<OwnerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Manager Mike')).toBeTruthy();
    });

    const deleteButtons = screen.getAllByRole('button', { name: 'common:delete' });
    fireEvent.click(deleteButtons[2]); // index 2 is user Manager Mike

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(deleteUser).toHaveBeenCalledWith(10);
      expect(mockAddToast).toHaveBeenCalledWith('Deleted user Manager Mike.', 'success');
    });
  });
});
