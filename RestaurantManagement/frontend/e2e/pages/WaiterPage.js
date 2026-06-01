exports.WaiterPage = class WaiterPage {
    constructor(page) {
        this.page = page;
        this.dashboardHeader = page.getByText('Active Shift');
        this.newOrderButton = page.getByText('New Order');
        this.tableNumberInput = page.getByPlaceholder('Table number', { exact: false });
        this.submitOrderButton = page.getByText('Send to Kitchen', { exact: true });
    }

    async createOrder(tableNum = '12', itemName = null) {
        await this.newOrderButton.dispatchEvent('click');
        await this.tableNumberInput.fill(tableNum);
        
        if (itemName) {
            // Find container of the specific menu item, then locate and click its '+' button
            const itemContainer = this.page.locator('div').filter({ hasText: itemName }).last();
            const plusButton = itemContainer.getByText('+', { exact: true }).first();
            await plusButton.dispatchEvent('click');
        } else {
            // Click the first '+' button found on the screen if no item is specified
            const firstPlus = this.page.getByText('+', { exact: true }).first();
            await firstPlus.dispatchEvent('click');
        }

        await this.submitOrderButton.dispatchEvent('click');
    }
};
