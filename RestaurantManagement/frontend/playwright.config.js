// frontend/playwright.config.js
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './e2e/tests', // Updated to target the tests folder
    fullyParallel: true,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:8081',
        trace: 'on-first-retry',
        testIdAttribute: 'data-testid' // Critical for React Native Web
    },
    projects: [
        { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
    ],
    webServer: {
        command: 'npm run start:mobile:web',
        url: 'http://localhost:8081',
        reuseExistingServer: true,
        timeout: 120000,
    },
});
