/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import WaiterDashboard from '../WaiterDashboard';
import { getOrders, getMenu, createOrder, updateOrderStatus } from '../../api/client';
import useToast from '../../hooks/useToast';

// Mock dependencies
jest.mock('../../api/client', () => ({
  getOrders: jest.fn(),
  getMenu: jest.fn(),
  createOrder: jest.fn(),
  updateOrderStatus: jest.fn(),
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

describe('WaiterDashboard', () => {
  const mockUser = { name: 'Waiter Will', id: 5 };
  const mockOnLogout = jest.fn();
  const mockAddToast = jest.fn();

  const mockOrders = [
    {
      id: 501,
      status: 'pending',
      table_number: '12',
      created_at: new Date(Date.now() - 10 * 60000).toISOString(),
      total_amount: 25.00,
      notes: 'Extra sauce',
      items: [{ id: 1, item_name: 'Burger', quantity: 1, unit_price: 15.00, category: 'Mains' }],
    },
    {
      id: 502,
      status: 'ready',
      table_number: '14',
      created_at: new Date(Date.now() - 5 * 60000).toISOString(),
      total_amount: 10.00,
      notes: '',
      items: [{ id: 2, item_name: 'Fries', quantity: 1, unit_price: 10.00, category: 'Sides' }],
    },
  ];

  const mockMenu = [
    { id: 101, name: 'Burger', price: 15.00, category: 'Mains' },
    { id: 102, name: 'Fries', price: 10.00, category: 'Sides' },
  ];

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    useToast.mockReturnValue({
      toasts: [],
      addToast: mockAddToast,
      removeToast: jest.fn(),
    });

    getOrders.mockResolvedValue({ data: { orders: mockOrders } });
    getMenu.mockResolvedValue({ data: { menu: mockMenu } });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('loads orders and menu, and selects default order details', async () => {
    render(<WaiterDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.queryByText('loadingDashboard')).not.toBeTruthy();
    });

    expect(getOrders).toHaveBeenCalled();
    expect(getMenu).toHaveBeenCalled();

    // Expect table number 12 (first active order) to be selected by default
    expect(screen.getByText('tableLabel_12')).toBeTruthy();
    expect(screen.getByText('Burger')).toBeTruthy();
    expect(screen.getByText('qty_Mains_1')).toBeTruthy();
  });

  it('allows clicking an order to view its details', async () => {
    render(<WaiterDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByText('tableLabel_12')).toBeTruthy();
    });

    // Click order 14 (id: 502)
    const tableButtons = screen.getAllByRole('button');
    const btn14 = tableButtons.find((btn) => btn.textContent.includes('14'));
    fireEvent.click(btn14);

    await waitFor(() => {
      expect(screen.getByText('tableLabel_14')).toBeTruthy();
      expect(screen.getByText('Fries')).toBeTruthy();
    });
  });

  it('serves a ready order successfully from the list or detail view', async () => {
    updateOrderStatus.mockResolvedValueOnce({});
    render(<WaiterDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByText('tableLabel_12')).toBeTruthy();
    });

    // Click "serve" button in the ready to serve list
    const serveButton = screen.getByRole('button', { name: 'serve' });
    fireEvent.click(serveButton);

    await waitFor(() => {
      expect(updateOrderStatus).toHaveBeenCalledWith(502, 'closed');
    });
  });

  it('serves selected order via detail view markServed button', async () => {
    updateOrderStatus.mockResolvedValueOnce({});
    render(<WaiterDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByText('tableLabel_12')).toBeTruthy();
    });

    // Select order 502 (table 14) which is ready
    const tableButtons = screen.getAllByRole('button');
    const btn14 = tableButtons.find((btn) => btn.textContent.includes('14'));
    fireEvent.click(btn14);

    // Click "markServed" button in detail panel (which is now enabled because status is ready)
    const markServedButton = screen.getByRole('button', { name: /markServed/i });
    fireEvent.click(markServedButton);

    await waitFor(() => {
      expect(updateOrderStatus).toHaveBeenCalledWith(502, 'closed');
    });
  });

  it('validates order builder form (at least one item required)', async () => {
    render(<WaiterDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByText('createNewOrder')).toBeTruthy();
    });

    // Open order builder
    fireEvent.click(screen.getByRole('button', { name: /createNewOrder/i }));

    // Click submit order without selecting items
    fireEvent.click(screen.getByRole('button', { name: 'sendToKitchen' }));

    expect(mockAddToast).toHaveBeenCalledWith('selectAtLeastOne', 'error');
  });

  it('submits a new order successfully', async () => {
    createOrder.mockResolvedValueOnce({});
    render(<WaiterDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByText('createNewOrder')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /createNewOrder/i }));

    // Input table number and notes
    fireEvent.change(screen.getByPlaceholderText('24'), { target: { value: '15' } });
    fireEvent.change(screen.getByPlaceholderText('notesPlaceholder'), { target: { value: 'Allergies: gluten' } });

    // Increment burger quantity by 2
    const plusButtons = screen.getAllByRole('button', { name: '+' });
    fireEvent.click(plusButtons[0]);
    fireEvent.click(plusButtons[0]);

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'sendToKitchen' }));

    await waitFor(() => {
      expect(createOrder).toHaveBeenCalledWith({
        table_number: '15',
        notes: 'Allergies: gluten',
        items: [{ menu_item_id: 101, quantity: 2 }],
      });
    });
  });

  it('handles create order failure gracefully', async () => {
    createOrder.mockRejectedValueOnce({ response: { data: { error: 'Failed to create order' } } });
    render(<WaiterDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByText('createNewOrder')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /createNewOrder/i }));
    const plusButtons = screen.getAllByRole('button', { name: '+' });
    fireEvent.click(plusButtons[0]);

    fireEvent.click(screen.getByRole('button', { name: 'sendToKitchen' }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Failed to create order', 'error');
    });
  });

  it('polls the backend for updates using interval', async () => {
    render(<WaiterDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(getOrders).toHaveBeenCalledTimes(1);
    });

    act(() => {
      jest.advanceTimersByTime(15000);
    });

    expect(getOrders).toHaveBeenCalledTimes(2);
  });

  it('handles logout and manual refresh clicks', async () => {
    render(<WaiterDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'common:refresh' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'common:refresh' }));
    expect(getOrders).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'common:logout' })[0]);
    expect(mockOnLogout).toHaveBeenCalled();
  });
});
