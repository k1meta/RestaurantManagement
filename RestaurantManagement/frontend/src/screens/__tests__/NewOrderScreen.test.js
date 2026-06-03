import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import NewOrderScreen from '../NewOrderScreen';
import { getMenu, createOrder } from '../../api/client';
import { Alert } from 'react-native';

jest.mock('../../api/client', () => ({
  getMenu: jest.fn(),
  createOrder: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }) => children,
}));

jest.mock('../../components/kinetic/KineticHeader', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ title }) => React.createElement(View, null, title),
  };
});

jest.spyOn(Alert, 'alert');

describe('NewOrderScreen', () => {
  const mockNavigation = { goBack: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    getMenu.mockResolvedValue({ data: { menu: [] } });
    createOrder.mockResolvedValue({});
  });

  it('loads menu, changes quantities (including decrement to 0), and submits order successfully', async () => {
    const mockMenu = [
      { id: 1, name: 'Burger', price: '10.00', category: 'Mains' },
      { id: 2, name: 'Fries', price: '5.00', category: 'Sides' },
    ];
    getMenu.mockResolvedValueOnce({ data: { menu: mockMenu } });
    createOrder.mockResolvedValueOnce({});

    render(<NewOrderScreen navigation={mockNavigation} />);

    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeTruthy();
      expect(screen.getByText('Fries')).toBeTruthy();
    });

    const plusButtons = screen.getAllByText('+');
    const minusButtons = screen.getAllByText('−');

    // Add 2 burgers
    fireEvent.press(plusButtons[0]);
    fireEvent.press(plusButtons[0]);

    // Add 1 Fries
    fireEvent.press(plusButtons[1]);

    // Check cart values
    expect(screen.getByText('3 items')).toBeTruthy();
    expect(screen.getByText('$25.00')).toBeTruthy();

    // Decrement fries back to 0
    fireEvent.press(minusButtons[1]);
    expect(screen.getByText('2 items')).toBeTruthy();
    expect(screen.getByText('$20.00')).toBeTruthy();

    // Input table number and notes
    fireEvent.changeText(screen.getByPlaceholderText('Table number (e.g. 12, B2)'), 'B2');
    fireEvent.changeText(screen.getByPlaceholderText('Allergies, modifiers, guest requests…'), 'No onions');

    // Click Send to Kitchen
    fireEvent.press(screen.getByText('Send to Kitchen'));

    await waitFor(() => {
      expect(createOrder).toHaveBeenCalledWith({
        table_number: 'B2',
        notes: 'No onions',
        items: [{ menu_item_id: 1, quantity: 2 }],
      });
    });

    // Check success Alert and trigger navigation
    expect(Alert.alert).toHaveBeenCalledWith('Order created', 'The kitchen has been notified.', expect.any(Array));
    
    const okBtn = Alert.alert.mock.calls[0][2].find(btn => btn.text === 'OK');
    okBtn.onPress();
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('validates empty order submission with Alert', async () => {
    getMenu.mockResolvedValueOnce({ data: { menu: [] } });

    render(<NewOrderScreen navigation={mockNavigation} />);

    await waitFor(() => {
      expect(screen.getByText('Build Order')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Send to Kitchen'));

    expect(Alert.alert).toHaveBeenCalledWith('Empty order', 'Add at least one item to the order.');
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('handles create order API failure with Alert', async () => {
    const mockMenu = [{ id: 1, name: 'Burger', price: '10.00', category: 'Mains' }];
    getMenu.mockResolvedValueOnce({ data: { menu: mockMenu } });
    createOrder.mockRejectedValueOnce({
      response: { data: { error: 'Kitchen capacity exceeded' } },
    });

    render(<NewOrderScreen navigation={mockNavigation} />);

    await waitFor(() => {
      expect(screen.getByText('Burger')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('+'));
    fireEvent.press(screen.getByText('Send to Kitchen'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Kitchen capacity exceeded');
    });
  });

  it('handles menu loading failure with Alert', async () => {
    getMenu.mockRejectedValueOnce(new Error('Network error'));

    render(<NewOrderScreen navigation={mockNavigation} />);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Could not load menu');
    });
  });
});
