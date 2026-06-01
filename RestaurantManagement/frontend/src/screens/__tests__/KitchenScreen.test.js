import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import KitchenScreen from '../KitchenScreen';
import { getOrders, updateOrderStatus } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

jest.mock('../../api/client', () => ({
  getOrders: jest.fn(),
  updateOrderStatus: jest.fn(),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => children,
}));

// Use ES default export mockup for components to avoid Element type is invalid crash
jest.mock('../../components/kinetic/KineticHeader', () => ({
  __esModule: true,
  default: 'KineticHeader',
}));
jest.mock('../../components/kinetic/MetricTile', () => ({
  __esModule: true,
  default: 'MetricTile',
}));
jest.mock('../../components/kinetic/KineticSectionTitle', () => ({
  __esModule: true,
  default: 'KineticSectionTitle',
}));

describe('KitchenScreen', () => {
  const mockLogout = jest.fn();
  const mockUser = { name: 'Chef Mario', location_name: 'Main Kitchen' };

  beforeEach(() => {
    jest.resetAllMocks();
    useAuth.mockReturnValue({
      user: mockUser,
      logout: mockLogout,
    });
  });

  it('renders successfully, loads orders and handles bump and ready actions', async () => {
    const mockOrders = [
      {
        id: 1,
        status: 'pending',
        created_at: new Date().toISOString(),
        items: [{ id: 101, item_name: 'Pasta', quantity: 2, notes: 'No gluten' }],
        notes: 'Order notes',
      },
      {
        id: 2,
        status: 'ready',
        created_at: new Date().toISOString(),
        items: [],
      },
    ];
    getOrders.mockResolvedValueOnce({ data: { orders: mockOrders } });
    updateOrderStatus.mockResolvedValueOnce({});
    getOrders.mockResolvedValueOnce({ data: { orders: [{ ...mockOrders[0], status: 'preparing' }, mockOrders[1]] } });

    render(<KitchenScreen />);

    await waitFor(() => {
      expect(screen.getByText('#1')).toBeTruthy();
    });

    // Verify item details are displayed
    expect(screen.getByText('Pasta')).toBeTruthy();
    expect(screen.getByText('No gluten')).toBeTruthy();
    expect(screen.getByText('Order notes')).toBeTruthy();

    // Click "Bump" on order 1
    fireEvent.press(screen.getByText('Bump'));

    await waitFor(() => {
      expect(updateOrderStatus).toHaveBeenCalledWith(1, 'preparing');
    });

    // Click "Mark Ready" on order 1
    updateOrderStatus.mockResolvedValueOnce({});
    fireEvent.press(screen.getByText('Mark Ready'));

    await waitFor(() => {
      expect(updateOrderStatus).toHaveBeenCalledWith(1, 'ready');
    });
  });

  it('handles order fetch errors gracefully', async () => {
    getOrders.mockRejectedValueOnce(new Error('Network Error'));

    render(<KitchenScreen />);

    await waitFor(() => {
      expect(getOrders).toHaveBeenCalled();
    });
  });
});
