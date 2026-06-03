const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const { WaiterPage } = require('../pages/WaiterPage');
const { KitchenPage } = require('../pages/KitchenPage');

test.describe('Role-Based Operations', () => {
    test('4. Waiter Order Submission', async ({ page }) => {
        const loginPage = new LoginPage(page);
        const waiterPage = new WaiterPage(page);

        await loginPage.goto();
        await loginPage.login('waiter@restaurant.com', 'password123');

        await expect(waiterPage.dashboardHeader).toBeVisible();

        const dialogPromise = page.waitForEvent('dialog');
        await waiterPage.createOrder('24');
        const dialog = await dialogPromise;
        expect(dialog.message()).toContain('Order created');

        await expect(waiterPage.dashboardHeader).toBeVisible();
    });

    test('5. Kitchen Display Access', async ({ page }) => {
        const loginPage = new LoginPage(page);
        const kitchenPage = new KitchenPage(page);

        await loginPage.goto();
        await loginPage.login('kitchen@restaurant.com', 'password123');

        // Assert kitchen specific UI elements
        await expect(kitchenPage.activeQueueTitle).toBeVisible();
        await expect(kitchenPage.activeTicketsTile).toBeVisible();
    });
});
