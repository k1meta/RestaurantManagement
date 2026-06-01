/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import KitchenDashboard from '../KitchenDashboard';
import { getOrders, updateOrderStatus } from '../../api/client';
import useToast from '../../hooks/useToast';

// Mock dependencies
jest.mock('../../api/client', () => ({
  getOrders: jest.fn(),
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

describe('KitchenDashboard', () => {
  const mockUser = { name: 'Chef Gordon', id: 2 };
  const mockOnLogout = jest.fn();
  const mockAddToast = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    useToast.mockReturnValue({
      toasts: [],
      addToast: mockAddToast,
      removeToast: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const getMockOrders = () => [
    {
      id: 1,
      status: 'pending',
      created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 mins ago (delayed)
      notes: 'No onions',
      items: [{ id: 101, quantity: 2, item_name: 'Burger', category: 'Main' }],
    },
    {
      id: 2,
      status: 'ready',
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 mins ago
      notes: '',
      items: [{ id: 102, quantity: 1, item_name: 'Fries' }],
    },
    {
      id: 3,
      status: 'preparing',
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      items: [{ id: 103, quantity: 1, item_name: 'Coke', category: 'Drinks' }],
    },
  ];

  it('renders loading spinner and then orders', async () => {
    getOrders.mockResolvedValueOnce({ data: { orders: getMockOrders() } });

    render(<KitchenDashboard user={mockUser} onLogout={mockOnLogout} />);

    // Assert loading state
    expect(screen.getByText('loadingQueue')).toBeTruthy();

    // Wait for orders to load
    await waitFor(() => {
      expect(screen.queryByText('loadingQueue')).not.toBeTruthy();
    });

    // Check header and stats
    expect(screen.getByText('stationInfo_Chef Gordon')).toBeTruthy();
    expect(screen.getByText('activeTickets')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy(); // 2 active orders (id 1, id 3)
  });

  it('handles polling refresh with interval', async () => {
    getOrders.mockResolvedValue({ data: { orders: getMockOrders() } });

    render(<KitchenDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.queryByText('loadingQueue')).not.toBeTruthy();
    });

    expect(getOrders).toHaveBeenCalledTimes(1);

    // Advance time by 10 seconds
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(getOrders).toHaveBeenCalledTimes(2);
  });

  it('simulates viewMode switching (tabs)', async () => {
    getOrders.mockResolvedValue({ data: { orders: getMockOrders() } });

    render(<KitchenDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.queryByText('loadingQueue')).not.toBeTruthy();
    });

    // We have three viewMode buttons in desktop/mobile nav. Let's find and click "delayed"
    const delayedButtons = screen.getAllByRole('button', { name: 'warning delayed' });
    fireEvent.click(delayedButtons[0]);

    // Delayed view should show order 1 but not order 2 or 3
    expect(screen.getByText('ticket_1')).toBeTruthy();
    expect(screen.queryByText('ticket_2')).not.toBeTruthy();
    expect(screen.queryByText('ticket_3')).not.toBeTruthy();

    // Click "ready" filter
    const readyButtons = screen.getAllByRole('button', { name: 'done_all ready' });
    fireEvent.click(readyButtons[0]);

    expect(screen.queryByText('ticket_1')).not.toBeTruthy();
    expect(screen.getByText('ticket_2')).toBeTruthy();

    // Click "orders" (all)
    const allButtons = screen.getAllByRole('button', { name: 'receipt_long orders' });
    fireEvent.click(allButtons[0]);

    expect(screen.getByText('ticket_1')).toBeTruthy();
    expect(screen.getByText('ticket_2')).toBeTruthy();
    expect(screen.getByText('ticket_3')).toBeTruthy();
  });

  it('handles manual refresh', async () => {
    getOrders.mockResolvedValue({ data: { orders: getMockOrders() } });

    render(<KitchenDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.queryByText('loadingQueue')).not.toBeTruthy();
    });

    const refreshButton = screen.getByRole('button', { name: 'common:refresh' });
    fireEvent.click(refreshButton);

    expect(getOrders).toHaveBeenCalledTimes(2);
  });

  it('handles logout button click', async () => {
    getOrders.mockResolvedValue({ data: { orders: getMockOrders() } });

    render(<KitchenDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.queryByText('loadingQueue')).not.toBeTruthy();
    });

    const logoutButtons = screen.getAllByRole('button', { name: 'common:logout' });
    fireEvent.click(logoutButtons[0]);

    expect(mockOnLogout).toHaveBeenCalled();
  });

  it('successfully bumps order status and updates queue', async () => {
    getOrders.mockResolvedValue({ data: { orders: getMockOrders() } });
    updateOrderStatus.mockResolvedValueOnce({ data: {} });

    render(<KitchenDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.queryByText('loadingQueue')).not.toBeTruthy();
    });

    const bumpButtons = screen.getAllByRole('button', { name: 'bump' });
    
    // Bump order 1 (pending)
    fireEvent.click(bumpButtons[0]);

    await waitFor(() => {
      expect(updateOrderStatus).toHaveBeenCalledWith(1, 'preparing');
    });
  });

  it('successfully marks order as ready and updates queue', async () => {
    getOrders.mockResolvedValue({ data: { orders: getMockOrders() } });
    updateOrderStatus.mockResolvedValueOnce({ data: {} });

    render(<KitchenDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.queryByText('loadingQueue')).not.toBeTruthy();
    });

    const readyButtons = screen.getAllByRole('button', { name: 'markReady' });
    
    // Click markReady on order 3 (preparing)
    fireEvent.click(readyButtons[1]);

    await waitFor(() => {
      expect(updateOrderStatus).toHaveBeenCalledWith(3, 'ready');
    });
  });

  it('handles update status failure gracefully', async () => {
    getOrders.mockResolvedValue({ data: { orders: getMockOrders() } });
    updateOrderStatus.mockRejectedValueOnce({ response: { data: { error: 'Failed to bump' } } });

    render(<KitchenDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.queryByText('loadingQueue')).not.toBeTruthy();
    });

    const bumpButtons = screen.getAllByRole('button', { name: 'bump' });
    fireEvent.click(bumpButtons[0]);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Failed to bump', 'error');
    });
  });

  it('handles mark ready failure gracefully', async () => {
    getOrders.mockResolvedValue({ data: { orders: getMockOrders() } });
    updateOrderStatus.mockRejectedValueOnce(new Error('Failed to update'));

    render(<KitchenDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.queryByText('loadingQueue')).not.toBeTruthy();
    });

    const readyButtons = screen.getAllByRole('button', { name: 'markReady' });
    fireEvent.click(readyButtons[1]);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Could not mark order as ready', 'error');
    });
  });

  it('handles empty queue display', async () => {
    getOrders.mockResolvedValue({ data: { orders: [] } });

    render(<KitchenDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.queryByText('loadingQueue')).not.toBeTruthy();
    });

    expect(screen.getByText('queueClear')).toBeTruthy();
  });
});
