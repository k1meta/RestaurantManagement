const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');

test.describe('Authentication and Core Flows', () => {
    let loginPage;

    test.beforeEach(async ({ page }) => {
        loginPage = new LoginPage(page);
        await loginPage.goto();
    });

    test('1. Valid Waiter Login', async ({ page }) => {
        await loginPage.login('waiterstup1@restaurant.com', 'waiterstup1');
        await expect(page.getByText('Active Shift')).toBeVisible();
    });

    test('2. Invalid Login Credentials Rejection', async ({ page }) => {
        const dialogPromise = page.waitForEvent('dialog');
        await loginPage.login('wrong@restaurant.com', 'badpassword');
        const dialog = await dialogPromise;
        expect(dialog.message()).toContain('Login Failed');
    });

    test('3. Global Session Logout Flow', async ({ page }) => {
        await loginPage.login('managerstup1@restaurant.com', 'managerstup1');
        await expect(page.getByText('MISE EN PLACE')).toBeVisible();
        await loginPage.logout();
        await expect(loginPage.loginButton).toBeVisible();
    });
});
