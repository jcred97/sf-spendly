import { LightningElement, wire } from 'lwc';
import { loadStyle } from 'lightning/platformResourceLoader';
import LightningConfirm from 'lightning/confirm';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import removeDateFormatStyle from '@salesforce/resourceUrl/RemoveDateFormatStyle';

import getAllSpendings from '@salesforce/apex/SpendlyController.getAllSpendings';
import getCategoriesBySpending from '@salesforce/apex/SpendlyController.getCategoriesBySpending';
import getExpensesByFilters from '@salesforce/apex/SpendlyController.getExpensesByFilters';
import deleteExpense from '@salesforce/apex/SpendlyController.deleteExpense';
import deleteExpenses from '@salesforce/apex/SpendlyController.deleteExpenses';

const CHART_COLORS = ['#0070D2', '#04844B', '#FFB75D', '#E4A201', '#9E5BB5', '#E16032'];

const ALL_COLUMNS = [
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
                { label: 'Duplicate', name: 'duplicate' },
                { label: 'Delete', name: 'delete' }
            ]
        }
    }
];

const COLUMN_OPTIONS = [
    { key: 'expenseDate', label: 'Date' },
    { key: 'recordLink', label: 'Expense Name' },
    { key: 'category', label: 'Category' },
    { key: 'spending', label: 'Spending' },
    { key: 'bank', label: 'Bank' },
    { key: 'transactionType', label: 'Type' },
    { key: 'amount', label: 'Amount' }
];

export default class SpendlyApp extends LightningElement {

    startDate;
    endDate;
    spendingId = 'All';
    categoryId = 'All';
    searchTerm = '';

    spendingOptions = [{ label: 'All', value: 'All' }];
    categoryOptions = [{ label: 'All', value: 'All' }];

    allRows = [];
    selectedRows = [];

    sortedBy = 'expenseDate';
    sortedDirection = 'desc';
    isLoading = false;
    isModalOpen = false;
    editRecordId = null;
    duplicateData = null;
    isColumnPickerOpen = false;

    visibleCount = 20;
    dateError = '';

    columnVisibility = {
        expenseDate: true,
        recordLink: true,
        category: true,
        spending: true,
        bank: true,
        transactionType: true,
        amount: true
    };

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
        this.selectedRows = [];
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
                categoryId: r.Category__c,
                spending: r.Category__r?.Spending__r?.Name,
                bank: r.Bank__c,
                transactionType: r.Transaction_Type__c,
                amount: r.Amount__c
            }));

            this.visibleCount = 20;
        } catch (error) {
            this.showToast('Error', 'Failed to load expenses.', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    // ── Computed rows ──

    get filteredRows() {
        if (!this.searchTerm) return this.allRows;
        const term = this.searchTerm.toLowerCase();
        return this.allRows.filter(r =>
            (r.name || '').toLowerCase().includes(term) ||
            (r.category || '').toLowerCase().includes(term) ||
            (r.spending || '').toLowerCase().includes(term) ||
            (r.bank || '').toLowerCase().includes(term) ||
            (r.transactionType || '').toLowerCase().includes(term)
        );
    }

    get rowsToDisplay() {
        return this.filteredRows.slice(0, this.visibleCount);
    }

    // ── Column visibility ──

    get columns() {
        return ALL_COLUMNS.filter(col =>
            col.type === 'action' || this.columnVisibility[col.fieldName] !== false
        );
    }

    get columnPickerOptions() {
        return COLUMN_OPTIONS.map(col => ({
            key: col.key,
            label: col.label,
            checked: this.columnVisibility[col.key]
        }));
    }

    // ── Stats & chart ──

    get hasNoRows() {
        return this.filteredRows.length === 0 && !this.isLoading;
    }

    get hasSelectedRows() {
        return this.selectedRows.length > 0;
    }

    get selectedCount() {
        return this.selectedRows.length;
    }

    get totalAmount() {
        return this.filteredRows.reduce((sum, row) => sum + (row.amount || 0), 0);
    }

    get formattedTotal() {
        return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(this.totalAmount);
    }

    get expenseCount() {
        return this.filteredRows.length;
    }

    get averageExpense() {
        if (this.filteredRows.length === 0) return '₱0.00';
        const avg = this.totalAmount / this.filteredRows.length;
        return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(avg);
    }

    get topCategory() {
        if (this.filteredRows.length === 0) return { name: '—', amount: '₱0.00' };
        const map = {};
        this.filteredRows.forEach(r => {
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
        if (this.filteredRows.length === 0) return { name: '—', count: 0 };
        const map = {};
        this.filteredRows.forEach(r => {
            const bank = r.bank || 'Unknown';
            map[bank] = (map[bank] || 0) + 1;
        });
        const top = Object.entries(map).sort((a, b) => b[1] - a[1])[0];
        return { name: top[0], count: top[1] };
    }

    get categoryChartData() {
        if (this.filteredRows.length === 0) return [];
        const map = {};
        this.filteredRows.forEach(r => {
            const cat = r.category || 'Unknown';
            map[cat] = (map[cat] || 0) + (r.amount || 0);
        });
        const entries = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
        const max = entries[0]?.[1] || 1;
        return entries.map(([name, total], i) => ({
            key: `${name}-${i}`,
            name,
            formattedTotal: new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(total),
            barStyle: `--bar-color:${CHART_COLORS[i % CHART_COLORS.length]};--bar-width:${Math.round((total / max) * 100)}%`
        }));
    }

    get hasChartData() {
        return this.categoryChartData.length > 0;
    }

    // ── Handlers ──

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

    handleSearch(e) {
        this.searchTerm = e.detail.value;
        this.visibleCount = 20;
    }

    handleReset() {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const format = (d) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        this.startDate = format(firstDay);
        this.endDate = format(today);
        this.spendingId = 'All';
        this.categoryId = 'All';
        this.searchTerm = '';
        this.loadExpenses();
    }

    handleToggleColumnPicker() {
        this.isColumnPickerOpen = !this.isColumnPickerOpen;
    }

    handleColumnToggle(e) {
        const key = e.target.dataset.key;
        this.columnVisibility = { ...this.columnVisibility, [key]: e.target.checked };
    }

    handleRowSelection(event) {
        this.selectedRows = event.detail.selectedRows.map(r => r.id);
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
    }

    async handleLoadMore() {
        if (this.visibleCount >= this.filteredRows.length) return;

        this.isLoading = true;
        await new Promise(r => setTimeout(r, 500));
        this.visibleCount += 10;
        this.isLoading = false;
    }

    async handleRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;
        const recordId = row.id;
        if (!recordId) return;

        if (actionName === 'edit') {
            this.duplicateData = null;
            this.editRecordId = recordId;
            this.isModalOpen = true;
            return;
        }

        if (actionName === 'duplicate') {
            this.editRecordId = null;
            this.duplicateData = {
                Name: 'Copy of ' + row.name,
                Amount__c: row.amount,
                Category__c: row.categoryId,
                Expense_Date__c: row.expenseDate,
                Transaction_Type__c: row.transactionType,
                Bank__c: row.bank
            };
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

            // Optimistic: remove row immediately
            const idx = this.allRows.findIndex(r => r.id === recordId);
            const removed = this.allRows[idx];
            this.allRows = this.allRows.filter(r => r.id !== recordId);

            try {
                await deleteExpense({ expenseId: recordId });
                this.showToast('Deleted', 'Expense deleted successfully!', 'success');
            } catch (error) {
                // Revert on failure
                this.allRows = [
                    ...this.allRows.slice(0, idx),
                    removed,
                    ...this.allRows.slice(idx)
                ];
                this.showToast('Error', error?.body?.message || 'Failed to delete expense.', 'error');
            }
        }
    }

    async handleBulkDelete() {
        const count = this.selectedRows.length;
        const confirmed = await LightningConfirm.open({
            message: `Are you sure you want to delete ${count} expense(s)?`,
            variant: 'header',
            label: 'Confirm Bulk Deletion'
        });
        if (!confirmed) return;

        const idsToDelete = [...this.selectedRows];
        const removedRows = this.allRows.filter(r => idsToDelete.includes(r.id));
        const removedIndexes = removedRows.map(r => this.allRows.findIndex(a => a.id === r.id));

        // Optimistic: remove all selected rows immediately
        this.allRows = this.allRows.filter(r => !idsToDelete.includes(r.id));
        this.selectedRows = [];

        try {
            await deleteExpenses({ expenseIds: idsToDelete });
            this.showToast('Deleted', `${count} expense(s) deleted successfully!`, 'success');
        } catch (error) {
            // Revert on failure — restore rows at their original positions
            const restored = [...this.allRows];
            removedRows.forEach((row, i) => {
                restored.splice(removedIndexes[i], 0, row);
            });
            this.allRows = restored;
            this.selectedRows = idsToDelete;
            this.showToast('Error', error?.body?.message || 'Failed to delete expenses.', 'error');
        }
    }

    openModal() {
        this.editRecordId = null;
        this.duplicateData = null;
        this.isModalOpen = true;
    }

    handleModalClose() {
        this.isModalOpen = false;
        this.editRecordId = null;
        this.duplicateData = null;
    }

    async handleSuccess() {
        this.showToast('Success', 'Expense saved successfully!', 'success');
        await this.loadExpenses();
    }

    handleExportCsv() {
        if (this.hasNoRows) return;

        const headers = ['Date', 'Expense Name', 'Category', 'Spending', 'Bank', 'Type', 'Amount (PHP)'];
        const rows = this.filteredRows.map(r => [
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
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
