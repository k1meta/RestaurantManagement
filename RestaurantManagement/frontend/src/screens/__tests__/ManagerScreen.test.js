import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import ManagerScreen from '../ManagerScreen';
import {
  getOrders,
  getInventory,
  upsertInventoryItem,
  deleteInventoryItem,
  getSales,
  getIngredients,
  createIngredient,
} from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Alert } from 'react-native';

jest.mock('../../api/client', () => ({
  getOrders: jest.fn(),
  getInventory: jest.fn(),
  upsertInventoryItem: jest.fn(),
  deleteInventoryItem: jest.fn(),
  getSales: jest.fn(),
  getIngredients: jest.fn(),
  createIngredient: jest.fn(),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children }) => <View>{children}</View>,
  };
});

// Mock default export kinetic components
jest.mock('../../components/kinetic/KineticHeader', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ subtitle }) => (
      <View>
        <Text>{subtitle}</Text>
      </View>
    ),
  };
});

jest.mock('../../components/kinetic/MetricTile', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ label, value }) => (
      <View>
        <Text>{label}: {value}</Text>
      </View>
    ),
  };
});

jest.mock('../../components/kinetic/KineticSectionTitle', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ title }) => (
      <View>
        <Text>{title}</Text>
      </View>
    ),
  };
});

// Mock KineticTabBar to render pressable tabs
jest.mock('../../components/kinetic/KineticTabBar', () => {
  const React = require('react');
  const { TouchableOpacity, Text, View } = require('react-native');
  return {
    __esModule: true,
    default: ({ tabs, active, onChange }) => (
      <View>
        {tabs.map((t) => (
          <TouchableOpacity key={t.id} onPress={() => onChange(t.id)} testID={`tab-${t.id}`}>
            <Text>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    ),
  };
});

jest.spyOn(Alert, 'alert');

describe('ManagerScreen', () => {
  const mockLogout = jest.fn();
  const mockUser = { name: 'Manager Sarah', location_id: 2 };

  const mockOrders = [
    { id: 1, status: 'pending', table_number: '10', waiter_name: 'Waiter Joe' },
  ];

  const mockInventory = [
    { id: 10, ingredient: 'Cheese', quantity: 20, unit: 'Kg', status: 'stable', percent: 80, ingredient_id: 101 },
    { id: 11, ingredient: 'Tomato', quantity: 5, unit: 'Kg', status: 'warning', percent: 20, low_stock_threshold: 10, full_stock_target: 25, ingredient_id: 102 },
  ];

  const mockIngredients = [
    { id: 101, name: 'Cheese', default_unit: 'Kg' },
    { id: 102, name: 'Tomato', default_unit: 'Kg' },
  ];

  const mockSales = [
    { item_name: 'Cheeseburger', total_sold: 15, total_revenue: 150.00 },
  ];

  beforeEach(() => {
    jest.resetAllMocks();
    useAuth.mockReturnValue({
      user: mockUser,
      logout: mockLogout,
    });
    getOrders.mockResolvedValue({ data: { orders: mockOrders } });
    getInventory.mockResolvedValue({ data: { inventory: mockInventory } });
    getIngredients.mockResolvedValue({ data: { ingredients: mockIngredients } });
    getSales.mockResolvedValue({ data: { sales: mockSales } });
  });

  it('renders orders tab by default', async () => {
    render(<ManagerScreen />);

    await waitFor(() => {
      expect(getOrders).toHaveBeenCalled();
    });

    expect(screen.getByText('#1')).toBeTruthy();
    expect(screen.getByText('Table 10 • Waiter Joe')).toBeTruthy();
  });

  it('navigates to inventory tab and adds a new ingredient successfully', async () => {
    createIngredient.mockResolvedValueOnce({ data: { ingredient: { id: 103, name: 'Garlic' } } });
    upsertInventoryItem.mockResolvedValueOnce({});
    
    render(<ManagerScreen />);

    // Switch to inventory tab
    fireEvent.press(screen.getByTestId('tab-inventory'));

    await waitFor(() => {
      expect(getInventory).toHaveBeenCalled();
    });

    expect(screen.getByText('Cheese')).toBeTruthy();
    expect(screen.getByText('Tomato')).toBeTruthy();

    // Click Add/Update Button to open modal
    fireEvent.press(screen.getByText('Add / Update Ingredient'));

    // Try submitting with empty quantity
    fireEvent.press(screen.getByText('Save'));
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Quantity is required');

    // Set quantity
    fireEvent.changeText(screen.getByPlaceholderText('Quantity'), '10');
    
    // Try submitting with no ingredient name or id
    fireEvent.press(screen.getByText('Save'));
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Select an ingredient or provide a new ingredient name');

    // Fill in new ingredient details
    fireEvent.changeText(screen.getByPlaceholderText('Ingredient name'), 'Garlic');
    
    // Select default unit for new ingredient (press chip)
    fireEvent.press(screen.getAllByText('pieces')[0]);
    
    // Try saving without stock unit
    fireEvent.press(screen.getByText('Save'));
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Select a stock unit (Kg, g, pieces, L, ml)');

    // Select stock unit
    fireEvent.press(screen.getAllByText('Kg')[1]); // index 1 is stock unit chip row

    // Try setting invalid threshold (low > full)
    fireEvent.changeText(screen.getByPlaceholderText('Below = low stock'), '50');
    fireEvent.changeText(screen.getByPlaceholderText('Refill-to level'), '30');

    fireEvent.press(screen.getByText('Save'));
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Low stock threshold cannot exceed full stock target');

    // Correct the thresholds
    fireEvent.changeText(screen.getByPlaceholderText('Below = low stock'), '30');
    fireEvent.changeText(screen.getByPlaceholderText('Refill-to level'), '50');

    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => {
      expect(createIngredient).toHaveBeenCalledWith({ name: 'Garlic', default_unit: 'pieces' });
      expect(upsertInventoryItem).toHaveBeenCalledWith({
        ingredient_id: 103,
        quantity: 10,
        unit: 'Kg',
        low_stock_threshold: 30,
        full_stock_target: 50,
      });
    });
  });

  it('allows deleting an inventory item', async () => {
    deleteInventoryItem.mockResolvedValueOnce({});
    render(<ManagerScreen />);

    // Switch to inventory
    fireEvent.press(screen.getByTestId('tab-inventory'));

    await waitFor(() => {
      expect(screen.getByText('Cheese')).toBeTruthy();
    });

    // Delete Cheese item (first card close icon)
    // There are close icons in the top right. Let's find the pressable delete button in inventory card.
    // In InventoryCard: TouchableOpacity onPress={onDelete} wraps MaterialIcons name="close"
    // Let's find by accessibility label.
    fireEvent.press(screen.getByLabelText('Delete Cheese'));

    expect(Alert.alert).toHaveBeenCalled();
    const confirmDelete = Alert.alert.mock.calls[0][2].find(btn => btn.text === 'Delete');
    
    await act(async () => {
      await confirmDelete.onPress();
    });

    expect(deleteInventoryItem).toHaveBeenCalledWith(10);
  });

  it('navigates to sales tab and switches periods', async () => {
    render(<ManagerScreen />);

    // Switch to sales tab
    fireEvent.press(screen.getByTestId('tab-sales'));

    await waitFor(() => {
      expect(getSales).toHaveBeenCalledWith('monthly');
    });

    expect(screen.getByText('Cheeseburger')).toBeTruthy();
    expect(screen.getByText('15 sold • $150.00')).toBeTruthy();

    // Click "weekly" period
    fireEvent.press(screen.getByText('weekly'));

    await waitFor(() => {
      expect(getSales).toHaveBeenCalledWith('weekly');
    });
  });
});
