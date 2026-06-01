/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import ManagerDashboard from '../ManagerDashboard';
import {
  getInventory,
  getMenu,
  getUsers,
  getOrders,
  getIngredients,
  createMenuItem,
  createIngredient,
  createUser,
  deleteInventoryItem,
  deleteMenuItem,
  deleteUser,
  patchInventoryItem,
  updateMenuItem,
  updateUser,
  upsertInventoryItem,
} from '../../api/client';
import useToast from '../../hooks/useToast';

// Mock dependencies
jest.mock('../../api/client', () => ({
  getInventory: jest.fn(),
  getMenu: jest.fn(),
  getUsers: jest.fn(),
  getOrders: jest.fn(),
  getIngredients: jest.fn(),
  createMenuItem: jest.fn(),
  createIngredient: jest.fn(),
  createUser: jest.fn(),
  deleteInventoryItem: jest.fn(),
  deleteMenuItem: jest.fn(),
  deleteUser: jest.fn(),
  patchInventoryItem: jest.fn(),
  updateMenuItem: jest.fn(),
  updateUser: jest.fn(),
  upsertInventoryItem: jest.fn(),
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

// Mock window scrollTo and confirm
window.scrollTo = jest.fn();
window.HTMLElement.prototype.scrollIntoView = jest.fn();
const originalConfirm = window.confirm;

describe('ManagerDashboard', () => {
  const mockUser = { name: 'Manager Mike', id: 3 };
  const mockOnLogout = jest.fn();
  const mockAddToast = jest.fn();

  const mockInventory = [
    { id: 1, ingredient: 'Tomato', ingredient_id: 10, quantity: 20, unit: 'Kg', low_stock_threshold: 30, full_stock_target: 100 },
    { id: 2, ingredient: 'Cheese', ingredient_id: 11, quantity: 5, unit: 'Kg', low_stock_threshold: 10, full_stock_target: 20 },
  ];

  const mockMenu = [
    {
      id: 201,
      name: 'Pizza Margherita',
      price: 12.5,
      active: true,
      category: 'Main',
      ingredients: [{ ingredient_id: 10, quantity_required: 0.2, unit: 'Kg' }],
    },
  ];

  const mockStaff = [
    { id: 3, name: 'Manager Mike', email: 'mike@restaurant.com', role: 'manager' },
    { id: 4, name: 'John Waiter', email: 'john@restaurant.com', role: 'waiter' },
  ];

  const mockIngredients = [
    { id: 10, name: 'Tomato', default_unit: 'Kg' },
    { id: 11, name: 'Cheese', default_unit: 'Kg' },
  ];

  beforeEach(() => {
    jest.resetAllMocks();
    window.confirm = jest.fn(() => true);

    useToast.mockReturnValue({
      toasts: [],
      addToast: mockAddToast,
      removeToast: jest.fn(),
    });

    getInventory.mockResolvedValue({ data: { inventory: mockInventory } });
    getMenu.mockResolvedValue({ data: { menu: mockMenu } });
    getUsers.mockResolvedValue({ data: { users: mockStaff } });
    getOrders.mockResolvedValue({ data: { orders: [] } });
    getIngredients.mockResolvedValue({ data: { ingredients: mockIngredients } });
  });

  afterAll(() => {
    window.confirm = originalConfirm;
  });

  afterEach(async () => {
    // Flush any pending microtasks and background state updates (e.g. loadDashboard) 
    // to prevent "not wrapped in act(...)" warnings.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });
  });

  it('loads and displays initial dashboard data successfully', async () => {
    render(<ManagerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(getInventory).toHaveBeenCalled();
      expect(getMenu).toHaveBeenCalled();
      expect(getUsers).toHaveBeenCalled();
      expect(getIngredients).toHaveBeenCalled();
      expect(screen.getByRole('heading', { name: 'Tomato' })).toBeTruthy();
    });

    expect(screen.getByDisplayValue('Pizza Margherita')).toBeTruthy();
    expect(screen.getByText('John Waiter')).toBeTruthy();
  });

  it('handles initial load failure gracefully', async () => {
    getInventory.mockRejectedValueOnce({ response: { data: { error: 'Database failure' } } });

    render(<ManagerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Database failure', 'error');
    });
  });

  it('handles navigation tab switching on mobile', async () => {
    render(<ManagerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tomato' })).toBeTruthy();
    });

    const menuTabButton = screen.getByRole('button', { name: /restaurant_menu\s+menu/i });
    fireEvent.click(menuTabButton);

    expect(menuTabButton.className).toContain('bg-[#1c1b1b]');
  });

  it('validates and creates a new staff user successfully', async () => {
    createUser.mockResolvedValueOnce({ data: { user: { id: 5, name: 'Staff member' } } });
    render(<ManagerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByText('John Waiter')).toBeTruthy();
    });

    const addUserButton = screen.getByRole('button', { name: 'addUser' });
    
    // Trigger validation error (empty inputs)
    fireEvent.click(addUserButton);
    expect(mockAddToast).toHaveBeenCalledWith('Name, email, and password are required to create a user', 'error');

    // Fill inputs
    fireEvent.change(screen.getByPlaceholderText('fullNamePlaceholder'), { target: { value: 'Jane Waiter' } });
    fireEvent.change(screen.getByPlaceholderText('emailPlaceholder'), { target: { value: 'jane@restaurant.com' } });
    fireEvent.change(screen.getByPlaceholderText('temporaryPasswordPlaceholder'), { target: { value: 'password123' } });
    
    fireEvent.click(addUserButton);

    await waitFor(() => {
      expect(createUser).toHaveBeenCalledWith({
        name: 'Jane Waiter',
        email: 'jane@restaurant.com',
        password: 'password123',
        role: 'waiter',
      });
      expect(mockAddToast).toHaveBeenCalledWith('New staff user created successfully.', 'success');
    });
  });

  it('handles user creation failure', async () => {
    createUser.mockRejectedValueOnce({ response: { data: { error: 'Email already exists' } } });
    render(<ManagerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByText('John Waiter')).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText('fullNamePlaceholder'), { target: { value: 'Jane Waiter' } });
    fireEvent.change(screen.getByPlaceholderText('emailPlaceholder'), { target: { value: 'jane@restaurant.com' } });
    fireEvent.change(screen.getByPlaceholderText('temporaryPasswordPlaceholder'), { target: { value: 'password123' } });
    
    fireEvent.click(screen.getByRole('button', { name: 'addUser' }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Email already exists', 'error');
    });
  });

  it('allows applying role change for a staff member', async () => {
    updateUser.mockResolvedValueOnce({});
    render(<ManagerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByText('John Waiter')).toBeTruthy();
    });

    // Select role select dropdown for John Waiter (id: 4)
    const roleSelects = screen.getAllByRole('combobox');
    // The role select dropdown is at the staff rows, let's select and change value
    const staffSelect = roleSelects.find(select => select.value === 'waiter');
    fireEvent.change(staffSelect, { target: { value: 'kitchen' } });

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith(4, { role: 'kitchen' });
      expect(mockAddToast).toHaveBeenCalledWith('Updated role for John Waiter.', 'success');
    });
  });

  it('allows removing a staff user after confirmation', async () => {
    deleteUser.mockResolvedValueOnce({});
    render(<ManagerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByText('John Waiter')).toBeTruthy();
    });

    const deleteUserButtons = screen.getAllByRole('button', { name: 'common:remove' });
    fireEvent.click(deleteUserButtons[0]);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(deleteUser).toHaveBeenCalledWith(4);
      expect(mockAddToast).toHaveBeenCalledWith('Deleted user John Waiter.', 'success');
    });
  });

  it('allows creating a new ingredient and saving it to inventory in the modal', async () => {
    createIngredient.mockResolvedValueOnce({ data: { ingredient: { id: 12, name: 'Garlic' } } });
    upsertInventoryItem.mockResolvedValueOnce({});
    render(<ManagerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tomato' })).toBeTruthy();
    });

    // Open inventory count modal
    fireEvent.click(screen.getByRole('button', { name: /manualCount/i }));

    const modal = screen.getByRole('heading', { name: 'manualInventoryCount' }).parentElement.parentElement;

    // Input new ingredient details
    fireEvent.change(within(modal).getByPlaceholderText('newIngredientPlaceholder'), { target: { value: 'Garlic' } });
    
    // Select unit dropdowns
    const modalSelects = within(modal).getAllByRole('combobox');
    // First select is existingIngredient, second is newIngredientUnit, third is unit
    fireEvent.change(modalSelects[1], { target: { value: 'pieces' } });

    // Input qty and select unit
    fireEvent.change(within(modal).getByPlaceholderText('50'), { target: { value: '10' } });
    fireEvent.change(modalSelects[2], { target: { value: 'pieces' } });

    // Save
    fireEvent.click(within(modal).getByRole('button', { name: 'common:save' }));

    await waitFor(() => {
      expect(createIngredient).toHaveBeenCalledWith({ name: 'Garlic', default_unit: 'pieces' });
      expect(upsertInventoryItem).toHaveBeenCalledWith({
        ingredient_id: 12,
        ingredient: undefined,
        quantity: 10,
        unit: 'pieces',
      });
      expect(mockAddToast).toHaveBeenCalledWith('Inventory count saved successfully.', 'success');
    });
  });

  it('validates threshold inputs when editing inventory item thresholds', async () => {
    patchInventoryItem.mockResolvedValueOnce({});
    render(<ManagerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tomato' })).toBeTruthy();
    });

    // Click "editThresholds" for Tomato
    const editThresholdButtons = screen.getAllByRole('button', { name: 'editThresholds' });
    fireEvent.click(editThresholdButtons[0]);

    // Low stock > full target
    const modalInputs = screen.getAllByPlaceholderText('common:optional');
    fireEvent.change(modalInputs[0], { target: { value: '150' } }); // lowStockThreshold
    fireEvent.change(modalInputs[1], { target: { value: '100' } }); // fullStockTarget

    fireEvent.click(screen.getByRole('button', { name: 'common:update' }));

    expect(mockAddToast).toHaveBeenCalledWith('Low stock threshold cannot exceed full stock target', 'error');
  });

  it('successfully updates inventory item thresholds', async () => {
    patchInventoryItem.mockResolvedValueOnce({});
    render(<ManagerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tomato' })).toBeTruthy();
    });

    const editThresholdButtons = screen.getAllByRole('button', { name: 'editThresholds' });
    fireEvent.click(editThresholdButtons[0]);

    const modalInputs = screen.getAllByPlaceholderText('common:optional');
    fireEvent.change(modalInputs[0], { target: { value: '40' } });
    fireEvent.change(modalInputs[1], { target: { value: '120' } });

    fireEvent.click(screen.getByRole('button', { name: 'common:update' }));

    await waitFor(() => {
      expect(patchInventoryItem).toHaveBeenCalledWith(1, {
        quantity: 20,
        unit: 'Kg',
        low_stock_threshold: 40,
        full_stock_target: 120,
      });
      expect(mockAddToast).toHaveBeenCalledWith('Inventory updated successfully.', 'success');
    });
  });

  it('allows deleting an inventory item', async () => {
    deleteInventoryItem.mockResolvedValueOnce({});
    render(<ManagerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tomato' })).toBeTruthy();
    });

    const deleteButtons = screen.getAllByRole('button', { name: 'common:delete' });
    fireEvent.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(deleteInventoryItem).toHaveBeenCalledWith(1);
      expect(mockAddToast).toHaveBeenCalledWith('Removed Tomato from inventory.', 'success');
    });
  });

  it('allows quick adjusting inventory quantity', async () => {
    patchInventoryItem.mockResolvedValueOnce({});
    render(<ManagerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tomato' })).toBeTruthy();
    });

    const qtyInputs = screen.getAllByPlaceholderText('onHandPlaceholder_20');
    fireEvent.change(qtyInputs[0], { target: { value: '25' } });

    const saveQtyButtons = screen.getAllByRole('button', { name: 'saveQty' });
    fireEvent.click(saveQtyButtons[0]);

    await waitFor(() => {
      expect(patchInventoryItem).toHaveBeenCalledWith(1, { quantity: 25 });
      expect(mockAddToast).toHaveBeenCalledWith('Updated Tomato quantity.', 'success');
    });
  });

  it('allows restocking a critical status item', async () => {
    upsertInventoryItem.mockResolvedValueOnce({});
    render(<ManagerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tomato' })).toBeTruthy();
    });

    const refillButtons = screen.getAllByRole('button', { name: 'refillTo_100' });
    fireEvent.click(refillButtons[0]);

    await waitFor(() => {
      expect(upsertInventoryItem).toHaveBeenCalledWith({
        ingredient_id: 10,
        ingredient: undefined,
        quantity: 100,
        unit: 'Kg',
      });
    });
  });

  it('allows refilling all low stock items', async () => {
    upsertInventoryItem.mockResolvedValue({});
    render(<ManagerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tomato' })).toBeTruthy();
    });

    const refillAllButton = screen.getByRole('button', { name: 'refillAllLow_2' });
    fireEvent.click(refillAllButton);

    await waitFor(() => {
      expect(upsertInventoryItem).toHaveBeenCalledTimes(2);
      expect(mockAddToast).toHaveBeenCalledWith('Refilled 2 low-stock ingredient(s) to target levels.', 'success');
    });
  });

  it('validates creating a new menu item and handles success', async () => {
    createMenuItem.mockResolvedValueOnce({});
    render(<ManagerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Pizza Margherita')).toBeTruthy();
    });

    const createFormContainer = screen.getByRole('heading', { name: 'createNewMenuItem' }).closest('div');
    const addMenuButton = within(createFormContainer).getByRole('button', { name: 'common:create' });
    
    // Missing inputs validation
    fireEvent.click(addMenuButton);
    expect(mockAddToast).toHaveBeenCalledWith('New menu item requires a name and valid price', 'error');

    // Fill inputs
    fireEvent.change(within(createFormContainer).getByPlaceholderText('exampleNamePlaceholder'), { target: { value: 'Pasta' } });
    fireEvent.change(within(createFormContainer).getByPlaceholderText('0.00'), { target: { value: '10.50' } });

    // Select ingredient from catalog dropdown
    const selectIngredient = within(createFormContainer).getByDisplayValue('common:selectIngredient');
    fireEvent.change(selectIngredient, { target: { value: '10' } }); // Tomato

    const qtyInput = within(createFormContainer).getByPlaceholderText('Qty');
    fireEvent.change(qtyInput, { target: { value: '0.1' } });

    const unitSelect = within(createFormContainer).getByDisplayValue('Select unit');
    fireEvent.change(unitSelect, { target: { value: 'Kg' } });

    fireEvent.click(addMenuButton);

    await waitFor(() => {
      expect(createMenuItem).toHaveBeenCalledWith({
        name: 'Pasta',
        category: null,
        price: 10.5,
        active: true,
        ingredients: [{ ingredient_id: 10, quantity_required: 0.1, unit: 'Kg' }],
      });
      expect(mockAddToast).toHaveBeenCalledWith('New menu item created successfully.', 'success');
    });
  });

  it('allows adding and removing ingredient rows in the new menu item form', async () => {
    render(<ManagerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Pizza Margherita')).toBeTruthy();
    });

    const createFormContainer = screen.getByRole('heading', { name: 'createNewMenuItem' }).closest('div');

    // Click "Add ingredient requirement"
    const addRowButton = within(createFormContainer).getByRole('button', { name: 'addIngredient' });
    fireEvent.click(addRowButton);

    // Check we have 2 ingredient rows in the create form (initial 1 + added 1 = 2)
    const qtyInputs = within(createFormContainer).getAllByPlaceholderText('Qty');
    expect(qtyInputs.length).toBe(2);

    // Remove the first row
    const deleteRowButtons = within(createFormContainer).getAllByRole('button', { name: 'common:remove' });
    fireEvent.click(deleteRowButtons[0]);

    // Check we are back to 1 ingredient row in the create form
    expect(within(createFormContainer).getAllByPlaceholderText('Qty').length).toBe(1);
  });

  it('allows saving menu item changes', async () => {
    updateMenuItem.mockResolvedValueOnce({});
    render(<ManagerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Pizza Margherita')).toBeTruthy();
    });

    const priceInputs = screen.getAllByRole('spinbutton');
    // First spinbutton in the Pizza Margherita edit block (which has price 12.5)
    // Wait, let's select it by display value or by order
    const priceInput = priceInputs.find(input => input.value === '12.5');
    fireEvent.change(priceInput, { target: { value: '14.99' } });

    const saveButtons = screen.getAllByRole('button', { name: 'common:save' });
    fireEvent.click(saveButtons[0]);

    await waitFor(() => {
      expect(updateMenuItem).toHaveBeenCalledWith(201, {
        name: 'Pizza Margherita',
        category: 'Main',
        price: 14.99,
        active: true,
        ingredients: [{ ingredient_id: 10, quantity_required: 0.2, unit: 'Kg' }],
      });
      expect(mockAddToast).toHaveBeenCalledWith('Saved changes for Pizza Margherita.', 'success');
    });
  });

  it('allows removing a menu item permanently, and deactivating it if conflict occurs', async () => {
    deleteMenuItem.mockRejectedValueOnce({ response: { status: 409, data: { error: 'Conflict' } } });
    updateMenuItem.mockResolvedValueOnce({});
    render(<ManagerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Pizza Margherita')).toBeTruthy();
    });

    const removeButtons = screen.getAllByRole('button', { name: 'removeFromMenu' });
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledTimes(2);
      expect(deleteMenuItem).toHaveBeenCalledWith(201);
      expect(updateMenuItem).toHaveBeenCalledWith(201, { active: false });
      expect(mockAddToast).toHaveBeenCalledWith('"Pizza Margherita" is now inactive (sold out).', 'success');
    });
  });

  it('allows publishing all changes at once', async () => {
    updateMenuItem.mockResolvedValue({});
    render(<ManagerDashboard user={mockUser} onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Pizza Margherita')).toBeTruthy();
    });

    const priceInputs = screen.getAllByRole('spinbutton');
    const priceInput = priceInputs.find(input => input.value === '12.5');
    fireEvent.change(priceInput, { target: { value: '15.99' } });

    // Click publish all
    const publishButton = screen.getByRole('button', { name: 'publishChanges' });
    fireEvent.click(publishButton);

    await waitFor(() => {
      expect(updateMenuItem).toHaveBeenCalledWith(201, {
        name: 'Pizza Margherita',
        category: 'Main',
        price: 15.99,
        active: true,
        ingredients: [{ ingredient_id: 10, quantity_required: 0.2, unit: 'Kg' }],
      });
      expect(mockAddToast).toHaveBeenCalledWith('Published 1 menu change(s).', 'success');
    });
  });
});
