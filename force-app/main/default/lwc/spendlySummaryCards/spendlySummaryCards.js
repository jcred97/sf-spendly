import { LightningElement, api } from 'lwc';

export default class SpendlySummaryCards extends LightningElement {
    @api formattedTotal = 'PHP 0.00';
    @api expenseCount = 0;
    @api averageExpense = 'PHP 0.00';
    @api topCategoryName = '-';
    @api topCategoryAmount = 'PHP 0.00';
    @api topBankName = '-';
    @api topBankCount = 0;
}
