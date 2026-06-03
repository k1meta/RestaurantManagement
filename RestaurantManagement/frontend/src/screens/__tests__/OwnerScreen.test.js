import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import OwnerScreen from '../OwnerScreen';
import { getSales, getOrders } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Alert } from 'react-native';

jest.mock('../../api/client', () => ({
  getSales: jest.fn(),
  getOrders: jest.fn(),
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

// Mock default export kinetic components
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

jest.spyOn(Alert, 'alert');

describe('OwnerScreen', () => {
  const mockLogout = jest.fn();
  const mockUser = { name: 'Owner Olivia' };

  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({
      user: mockUser,
      logout: mockLogout,
    });
    getSales.mockResolvedValue({ data: { sales: [], summary: { total_revenue: 0, total_orders: 0 } } });
    getOrders.mockResolvedValue({ data: { orders: [] } });
  });

  it('loads summary, location performance, and top sellers, and switches periods', async () => {
    const mockSales = [
      { location_name: 'Downtown', total_revenue: '500.00', item_name: 'Steak', total_sold: 10, location_id: 1 },
      { location_name: 'Uptown', total_revenue: '200.00', item_name: 'Salad', total_sold: 20, location_id: 2 },
    ];
    const mockSummary = { total_revenue: '700.00', total_orders: 15 };
    const mockOrders = [
      { status: 'pending', location_name: 'Downtown', location_id: 1, created_at: new Date().toISOString() },
      { status: 'closed', location_name: 'Downtown', location_id: 1, created_at: new Date().toISOString() },
    ];

    getSales.mockResolvedValue({ data: { sales: mockSales, summary: mockSummary } });
    getOrders.mockResolvedValue({ data: { orders: mockOrders } });

    render(<OwnerScreen />);

    await waitFor(() => {
      expect(screen.getByText('$700')).toBeTruthy();
      expect(screen.getByText('Downtown')).toBeTruthy();
      expect(screen.getByText('Uptown')).toBeTruthy();
      expect(screen.getByText('Steak')).toBeTruthy();
      expect(screen.getByText('Salad')).toBeTruthy();
    });

    // Verify watch border triggering (isWatch = activeOrders > 5)
    // Here active orders is 1. If we click yearly, it refetches.
    fireEvent.press(screen.getByText('yearly'));

    await waitFor(() => {
      expect(getSales).toHaveBeenCalledWith('yearly');
    });
  });

  it('handles negative path: API error Alert', async () => {
    getSales.mockRejectedValueOnce(new Error('Network error'));
    getOrders.mockResolvedValue({ data: { orders: [] } });

    render(<OwnerScreen />);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Could not load dashboard data');
    });
  });

  it('handles empty sales and location data displays', async () => {
    getSales.mockResolvedValue({ data: { sales: [], summary: {} } });
    getOrders.mockResolvedValue({ data: { orders: [] } });

    render(<OwnerScreen />);

    await waitFor(() => {
      expect(screen.getByText('No location data for this period')).toBeTruthy();
      expect(screen.getByText('No sales recorded for this period')).toBeTruthy();
    });
  });
});
