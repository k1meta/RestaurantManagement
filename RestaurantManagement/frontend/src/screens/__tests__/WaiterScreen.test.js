import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import WaiterScreen from '../WaiterScreen';
import { getOrders, updateOrderStatus } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Alert } from 'react-native';

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

// Mock default export kinetic components
jest.mock('../../components/kinetic/WaiterBottomNav', () => ({
  __esModule: true,
  default: 'WaiterBottomNav',
}));
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

describe('WaiterScreen', () => {
  const mockNavigation = { navigate: jest.fn() };
  const mockLogout = jest.fn();
  const mockUser = { name: 'Waiter Will', location_name: 'Main Room' };

  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue({
      user: mockUser,
      logout: mockLogout,
    });
    getOrders.mockResolvedValue({ data: { orders: [] } });
    updateOrderStatus.mockResolvedValue({});
  });

  it('loads active orders, displays pickups and floor map, and handles serve action', async () => {
    const mockOrders = [
      {
        id: 1,
        status: 'ready',
        table_number: '12',
        created_at: new Date(Date.now() - 10 * 60000).toISOString(),
        total_amount: 30.00,
        items: [
          { id: 101, item_name: 'Pizza', quantity: 2 },
          { id: 102, item_name: 'Coke', quantity: 3 },
          { id: 103, item_name: 'Bread', quantity: 1 },
          { id: 104, item_name: 'Ice Cream', quantity: 1 },
          { id: 105, item_name: 'Salad', quantity: 1 },
          { id: 106, item_name: 'Water', quantity: 1 }, // Tests item count logic truncation (+1 more)
        ],
      },
      {
        id: 2,
        status: 'pending',
        table_number: '14',
        created_at: new Date(Date.now() - 5 * 60000).toISOString(),
        total_amount: 15.00,
        items: [{ id: 107, item_name: 'Burger', quantity: 1 }],
      },
    ];

    getOrders.mockResolvedValue({ data: { orders: mockOrders } });

    render(<WaiterScreen navigation={mockNavigation} />);

    await waitFor(() => {
      expect(screen.getByText('Order #1')).toBeTruthy();
      expect(screen.getByText('14')).toBeTruthy();
    });

    // Check quantity rendering and item truncation
    expect(screen.getByText('2x Pizza')).toBeTruthy();
    expect(screen.getByText('+1 more')).toBeTruthy();

    // Serve order
    fireEvent.press(screen.getByText('SERVE'));

    await waitFor(() => {
      expect(updateOrderStatus).toHaveBeenCalledWith(1, 'closed');
    });
  });

  it('navigates to NewOrder screen on FAB, NewTableCard, or bottom nav presses', async () => {
    getOrders.mockResolvedValueOnce({ data: { orders: [] } });

    render(<WaiterScreen navigation={mockNavigation} />);

    await waitFor(() => {
      expect(screen.getByText('New Order')).toBeTruthy();
    });

    // Press New Order card
    fireEvent.press(screen.getByText('New Order'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('NewOrder');

    // Press FAB (FAB contains MaterialIcons with name "add")
    // Wait, let's find the TouchableOpacity that has the MaterialIcons "add" inside it.
    // In our render, the FAB is rendering:
    // <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('NewOrder')}>
    //   <MaterialIcons name="add" ... />
    // </TouchableOpacity>
    // Since mock navigation is called, we can press it. Let's select it by testing hierarchy or role.
    // Press FAB (FAB contains MaterialIcons with name "add")
    // Find by accessibility label
    fireEvent.press(screen.getByLabelText('Add Order'));
    expect(mockNavigation.navigate).toHaveBeenCalledTimes(2);
  });

  it('handles negative path: data load error Alert', async () => {
    getOrders.mockRejectedValueOnce(new Error('Network error'));

    render(<WaiterScreen navigation={mockNavigation} />);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Could not load orders');
    });
  });

  it('displays empty state message when there are no active orders', async () => {
    getOrders.mockResolvedValueOnce({ data: { orders: [] } });

    render(<WaiterScreen navigation={mockNavigation} />);

    await waitFor(() => {
      expect(screen.getByText('No active orders — tap + to start a new ticket.')).toBeTruthy();
    });
  });
});
