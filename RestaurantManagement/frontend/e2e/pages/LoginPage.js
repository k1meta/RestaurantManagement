exports.LoginPage = class LoginPage {
    constructor(page) {
        this.page = page;
        this.emailInput = page.getByPlaceholder('Email Address');
        this.passwordInput = page.getByPlaceholder('PIN / Password');
        this.loginButton = page.getByText('Sign In', { exact: true });
        this.menuButton = page.getByText('').or(page.getByText('menu')).first();
        this.lastDialogMessage = '';

        // Handle React Native Web's window.alert/confirm dialogs
        this.page.on('dialog', async (dialog) => {
            this.lastDialogMessage = dialog.message();
            if (dialog.message() === 'Account' || dialog.message().includes('Log out') || dialog.message().includes('Account\n')) {
                await dialog.accept(); // Trigger the Log out action
            } else {
                await dialog.accept(); // Accept error alerts or success messages to close them
            }
        });
    }

    async goto() {
        await this.page.goto('/');
    }

    async login(email, password) {
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.loginButton.dispatchEvent('click');
    }

    async logout() {
        await this.menuButton.dispatchEvent('click');
    }
};
