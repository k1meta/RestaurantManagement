exports.KitchenPage = class KitchenPage {
    constructor(page) {
        this.page = page;
        this.headerTitle = page.getByText('Kitchen', { exact: true });
        this.activeQueueTitle = page.getByText('Active Queue');
        this.activeTicketsTile = page.getByText('Active Tickets');
    }
};
