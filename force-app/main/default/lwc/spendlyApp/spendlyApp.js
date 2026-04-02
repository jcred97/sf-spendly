import { LightningElement, wire } from 'lwc';
import { loadStyle } from 'lightning/platformResourceLoader';
import LightningConfirm from 'lightning/confirm';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import removeDateFormatStyle from '@salesforce/resourceUrl/RemoveDateFormatStyle';

import getAllSpendings from '@salesforce/apex/SpendlyController.getAllSpendings';
import getCategoriesBySpending from '@salesforce/apex/SpendlyController.getCategoriesBySpending';
import getExpensesByFilters from '@salesforce/apex/SpendlyController.getExpensesByFilters';
import deleteExpense from '@salesforce/apex/SpendlyController.deleteExpense';

const CHART_COLORS = ['#0070D2', '#04844B', '#FFB75D', '#E4A201', '#9E5BB5', '#E16032'];

export default class SpendlyApp extends LightningElement {

    startDate;
    endDate;
    spendingId = 'All';
    categoryId = 'All';

    spendingOptions = [{ label: 'All', value: 'All' }];
    categoryOptions = [{ label: 'All', value: 'All' }];

    allRows = [];
    rowsToDisplay = [];

    sortedBy = 'expenseDate';
    sortedDirection = 'desc';
    isLoading = false;
    isModalOpen = false;
    editRecordId = null;

    visibleCount = 20;
    dateError = '';

    columns = [
        {
            label: 'Date',
            fieldName: 'expenseDate',
            type: 'date',
            sortable: true,
            typeAttributes: { year: 'numeric', month: 'short', day: '2-digit', timeZone: 'UTC' }
        },
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
            type: 'action',
            typeAttributes: {
                rowActions: [
                    { label: 'Edit', name: 'edit' },
                    { label: 'Delete', name: 'delete' }
                ]
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

        this.loadExpenses();
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

    async loadExpenses() {
        this.isLoading = true;
        try {
            const data = await getExpensesByFilters({
                spendingId: this.spendingId,
                categoryId: this.categoryId,
                startDate: this.startDate,
                endDate: this.endDate
            });

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
        } catch (error) {
            this.showToast('Error', 'Failed to load expenses.', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    get hasNoRows() {
        return this.allRows.length === 0 && !this.isLoading;
    }

    get totalAmount() {
        return this.allRows.reduce((sum, row) => sum + (row.amount || 0), 0);
    }

    get formattedTotal() {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP'
        }).format(this.totalAmount);
    }

    get expenseCount() {
        return this.allRows.length;
    }

    get averageExpense() {
        if (this.allRows.length === 0) return '₱0.00';
        const avg = this.totalAmount / this.allRows.length;
        return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(avg);
    }

    get topCategory() {
        if (this.allRows.length === 0) return { name: '—', amount: '₱0.00' };
        const map = {};
        this.allRows.forEach(r => {
            const cat = r.category || 'Unknown';
            map[cat] = (map[cat] || 0) + (r.amount || 0);
        });
        const top = Object.entries(map).sort((a, b) => b[1] - a[1])[0];
        return {
            name: top[0],
            amount: new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(top[1])
        };
    }

    get topBank() {
        if (this.allRows.length === 0) return { name: '—', count: 0 };
        const map = {};
        this.allRows.forEach(r => {
            const bank = r.bank || 'Unknown';
            map[bank] = (map[bank] || 0) + 1;
        });
        const top = Object.entries(map).sort((a, b) => b[1] - a[1])[0];
        return { name: top[0], count: top[1] };
    }

    get categoryChartData() {
        if (this.allRows.length === 0) return [];
        const map = {};
        this.allRows.forEach(r => {
            const cat = r.category || 'Unknown';
            map[cat] = (map[cat] || 0) + (r.amount || 0);
        });
        const entries = Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);
        const max = entries[0]?.[1] || 1;
        return entries.map(([name, total], i) => ({
            key: `${name}-${i}`,
            name,
            formattedTotal: new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(total),
            barStyle: `background-color:${CHART_COLORS[i % CHART_COLORS.length]};width:${Math.round((total / max) * 100)}%`
        }));
    }

    get hasChartData() {
        return this.categoryChartData.length > 0;
    }

    handleChange(e) {
        const field = e.target.dataset.field;
        this[field] = e.detail.value;

        if (field === 'spendingId') {
            this.categoryId = 'All';
        }

        if (field === 'startDate' || field === 'endDate') {
            this.validateDates();
            if (this.dateError) return;
        }

        this.loadExpenses();
    }

    validateDates() {
        if (this.startDate && this.endDate && this.startDate > this.endDate) {
            this.dateError = 'End Date cannot be before Start Date.';
        } else {
            this.dateError = '';
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
        const actionName = event.detail.action.name;
        const recordId = event.detail.row.id;
        if (!recordId) return;

        if (actionName === 'edit') {
            this.editRecordId = recordId;
            this.isModalOpen = true;
            return;
        }

        if (actionName === 'delete') {
            const confirmed = await LightningConfirm.open({
                message: 'Are you sure you want to delete this expense?',
                variant: 'header',
                label: 'Confirm Deletion'
            });

            if (!confirmed) return;

            try {
                await deleteExpense({ expenseId: recordId });
                this.showToast('Deleted', 'Expense deleted successfully!', 'success');
                await this.loadExpenses();
            } catch (error) {
                this.showToast(
                    'Error',
                    error?.body?.message || 'Failed to delete expense.',
                    'error'
                );
            }
        }
    }

    openModal() {
        this.editRecordId = null;
        this.isModalOpen = true;
    }

    handleModalClose() {
        this.isModalOpen = false;
        this.editRecordId = null;
    }

    async handleSuccess() {
        this.showToast('Success', 'Expense saved successfully!', 'success');
        await this.loadExpenses();
    }

    handleExportCsv() {
        if (this.hasNoRows) return;

        const headers = ['Date', 'Expense Name', 'Category', 'Spending', 'Bank', 'Type', 'Amount (PHP)'];
        const rows = this.allRows.map(r => [
            r.expenseDate || '',
            r.name || '',
            r.category || '',
            r.spending || '',
            r.bank || '',
            r.transactionType || '',
            r.amount != null ? r.amount : ''
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const link = document.createElement('a');
        link.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent));
        link.setAttribute('download', `spendly-expenses-${this.endDate || 'export'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
