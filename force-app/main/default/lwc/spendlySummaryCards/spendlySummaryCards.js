import { LightningElement, api } from 'lwc';

export default class SpendlySummaryCards extends LightningElement {
    @api formattedTotal = '₱0.00';
    @api expenseCount = 0;
    @api averageExpense = '₱0.00';
    @api topCategoryName = '—';
    @api topCategoryAmount = '₱0.00';
    @api topBankName = '—';
    @api topBankCount = 0;
}
