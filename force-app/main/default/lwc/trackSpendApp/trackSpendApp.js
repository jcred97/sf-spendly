import { LightningElement, wire } from 'lwc';
import { loadStyle } from 'lightning/platformResourceLoader';
import LightningConfirm from 'lightning/confirm';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import removeDateFormatStyle from '@salesforce/resourceUrl/RemoveDateFormatStyle';

import getAllSpendings from '@salesforce/apex/TrackSpendController.getAllSpendings';
import getCategoriesBySpending from '@salesforce/apex/TrackSpendController.getCategoriesBySpending';
import getExpensesByFilters from '@salesforce/apex/TrackSpendController.getExpensesByFilters';
import deleteExpense from '@salesforce/apex/TrackSpendController.deleteExpense';

export default class TrackSpendApp extends LightningElement {

    startDate;
    endDate;
    spendingId = 'All';
    categoryId = 'All';

    spendingOptions = [{ label: 'All', value: 'All' }];
    categoryOptions = [{ label: 'All', value: 'All' }];

    allRows = [];
    rowsToDisplay = [];

    sortedBy;
    sortedDirection = 'asc';
    isLoading = false;
    isModalOpen = false;

    visibleCount = 20;
    wiredExpenseResult;

    columns = [
        { label: 'Date', fieldName: 'expenseDate', type: 'date', sortable: true },
        {
            label: 'Expense Name',
            fieldName: 'recordLink',
            type: 'url',
            sortable: true,
            typeAttributes: { label: { fieldName: 'name' }, target: '_blank' }
        },
        { label: 'Category', fieldName: 'category', sortable: true },
        { label: 'Spending', fieldName: 'spending', sortable: true },
        { label: 'Bank', fieldName: 'bank', sortable: true },
        { label: 'Type', fieldName: 'transactionType', sortable: true },
        {
            label: 'Amount',
            fieldName: 'amount',
            type: 'currency',
            typeAttributes: { currencyCode: 'PHP' },
            sortable: true
        },
        {
            type: 'button-icon',
            fixedWidth: 50,
            typeAttributes: {
                iconName: 'utility:delete',
                title: 'Delete',
                variant: 'bare',
                alternativeText: 'Delete'
            }
        }
    ];

    renderedCallback() {
        loadStyle(this, removeDateFormatStyle);
    }

    connectedCallback() {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

        const format = (d) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
                d.getDate()
            ).padStart(2, '0')}`;

        this.startDate = format(firstDay);
        this.endDate = format(today);
    }

    @wire(getAllSpendings)
    wiredSpendings({ error, data }) {
        if (data) {
            this.spendingOptions = [
                { label: 'All', value: 'All' },
                ...data.map(s => ({ label: s.Name, value: s.Id }))
            ];
        } else if (error) {
            this.showToast('Error', 'Failed to load spendings.', 'error');
        }
    }

    @wire(getCategoriesBySpending, { spendingId: '$spendingId' })
    wiredCategories({ error, data }) {
        if (data) {
            this.categoryOptions = [
                { label: 'All', value: 'All' },
                ...data.map(c => ({ label: c.Name, value: c.Id }))
            ];
        } else if (error) {
            this.showToast('Error', 'Failed to load categories.', 'error');
        }
    }

    @wire(getExpensesByFilters, {
        spendingId: '$spendingId',
        categoryId: '$categoryId',
        startDate: '$startDate',
        endDate: '$endDate'
    })
    wiredExpenses(result) {
        this.wiredExpenseResult = result;
        const { error, data } = result;

        if (data) {
            this.allRows = data.map(r => ({
                id: r.Id,
                expenseDate: r.Expense_Date__c,
                name: r.Name,
                recordLink: '/' + r.Id,
                category: r.Category__r?.Name,
                spending: r.Category__r?.Spending__r?.Name,
                bank: r.Bank__c,
                transactionType: r.Transaction_Type__c,
                amount: r.Amount__c
            }));

            this.visibleCount = 20;
            this.rowsToDisplay = this.allRows.slice(0, this.visibleCount);
        } else if (error) {
            this.showToast('Error', 'Failed to load expenses.', 'error');
        }
    }

    handleChange(e) {
        const field = e.target.dataset.field;
        this[field] = e.detail.value;

        if (field === 'spendingId') {
            this.categoryId = 'All';
        }
    }

    handleSort(event) {
        const { fieldName, sortDirection } = event.detail;
        this.sortedBy = fieldName;
        this.sortedDirection = sortDirection;

        const isAsc = sortDirection === 'asc';

        this.allRows = [...this.allRows].sort((a, b) =>
            a[fieldName] > b[fieldName] ? (isAsc ? 1 : -1) : (isAsc ? -1 : 1)
        );

        this.rowsToDisplay = this.allRows.slice(0, this.visibleCount);
    }

    async handleLoadMore() {
        if (this.rowsToDisplay.length >= this.allRows.length) return;

        this.isLoading = true;
        await new Promise(r => setTimeout(r, 500));
        this.visibleCount += 10;
        this.rowsToDisplay = this.allRows.slice(0, this.visibleCount);
        this.isLoading = false;
    }

    async handleRowAction(event) {
        const recordId = event.detail.row.id;
        if (!recordId) return;

        const confirmed = await LightningConfirm.open({
            message: 'Are you sure you want to delete this expense?',
            variant: 'header',
            label: 'Confirm Deletion'
        });

        if (!confirmed) return;

        try {
            await deleteExpense({ expenseId: recordId });
            this.showToast('Deleted', 'Expense deleted successfully!', 'success');
            await refreshApex(this.wiredExpenseResult);
        } catch (error) {
            this.showToast(
                'Error',
                error?.body?.message || 'Failed to delete expense.',
                'error'
            );
        }
    }

    openModal() {
        this.isModalOpen = true;
    }

    handleModalClose() {
        this.isModalOpen = false;
    }

    async handleSuccess() {
        this.showToast('Success', 'Expense saved successfully!', 'success');
        await refreshApex(this.wiredExpenseResult);
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }
}
