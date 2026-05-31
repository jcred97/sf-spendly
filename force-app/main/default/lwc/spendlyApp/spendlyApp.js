import { LightningElement, wire } from 'lwc';
import { loadStyle } from 'lightning/platformResourceLoader';
import LightningConfirm from 'lightning/confirm';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import removeDateFormatStyle from '@salesforce/resourceUrl/RemoveDateFormatStyle';

import getAllExpenseGroups from '@salesforce/apex/SpendlyController.getAllExpenseGroups';
import getCategoriesByExpenseGroup from '@salesforce/apex/SpendlyController.getCategoriesByExpenseGroup';
import getExpensesByFilters from '@salesforce/apex/SpendlyController.getExpensesByFilters';
import deleteExpense from '@salesforce/apex/SpendlyController.deleteExpense';
import deleteExpenses from '@salesforce/apex/SpendlyController.deleteExpenses';
import getMonthlyTrend from '@salesforce/apex/SpendlyController.getMonthlyTrend';

const CHART_COLORS = ['#0070D2', '#04844B', '#FFB75D', '#E4A201', '#9E5BB5', '#E16032'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PAGE_SIZE = 20;
const LOAD_MORE_SIZE = 10;
const VIEW_CONFIG = [
    {
        key: 'dashboard',
        label: 'Dashboard',
        title: 'Dashboard',
        subtitle: 'Overview of current filtered spending',
        iconName: 'utility:chart'
    },
    {
        key: 'transactions',
        label: 'Transactions',
        title: 'Transactions',
        subtitle: 'Review, filter, export, and maintain expenses',
        iconName: 'utility:table'
    },
    {
        key: 'recurring',
        label: 'Recurring',
        title: 'Recurring',
        subtitle: 'Monitor recurring expense templates',
        iconName: 'utility:sync'
    },
    {
        key: 'settings',
        label: 'Settings',
        title: 'Settings',
        subtitle: 'Automation and workspace preferences',
        iconName: 'utility:settings'
    }
];

const PHP_CURRENCY = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const DATE_FORMAT = new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    timeZone: 'UTC'
});

const ALL_COLUMNS = [
    {
        label: 'Date',
        fieldName: 'expenseDate',
        type: 'date',
        sortable: true,
        typeAttributes: { year: 'numeric', month: 'short', day: '2-digit', timeZone: 'UTC' }
    },
    { label: 'Time', fieldName: 'transactionTimeDisplay', sortable: true },
    {
        label: 'Expense Name',
        fieldName: 'recordLink',
        type: 'url',
        sortable: true,
        typeAttributes: { label: { fieldName: 'name' }, target: '_blank' }
    },
    { label: 'Category', fieldName: 'category', sortable: true },
    { label: 'Expense Group', fieldName: 'expenseGroup', sortable: true },
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
    { key: 'transactionTimeDisplay', label: 'Time' },
    { key: 'recordLink', label: 'Expense Name' },
    { key: 'category', label: 'Category' },
    { key: 'expenseGroup', label: 'Expense Group' },
    { key: 'bank', label: 'Bank' },
    { key: 'transactionType', label: 'Type' },
    { key: 'amount', label: 'Amount' }
];

function formatPHP(value) {
    return PHP_CURRENCY.format(value);
}

function formatDate(isoDate) {
    return isoDate ? DATE_FORMAT.format(new Date(isoDate)) : '-';
}

function formatTime(value) {
    if (!value) {
        return '-';
    }

    const timeValue = typeof value === 'number' ? millisecondsToTime(value) : value;
    const [hourText, minuteText] = String(timeValue).split(':');
    const hour = Number(hourText);
    const minute = Number(minuteText);

    if (Number.isNaN(hour) || Number.isNaN(minute)) {
        return '-';
    }

    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

function millisecondsToTime(value) {
    const totalMinutes = Math.floor(value / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000`;
}

function formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseDateString(value) {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function groupByAmount(rows, field) {
    const map = {};
    rows.forEach(row => {
        const key = row[field] || 'Unknown';
        map[key] = (map[key] || 0) + (row.amount || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function groupByCount(rows, field) {
    const map = {};
    rows.forEach(row => {
        const key = row[field] || 'Unknown';
        map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function buildBarChartData(entries, prefix) {
    const max = entries[0]?.[1] || 1;
    return entries.map(([name, total], index) => ({
        key: `${prefix}-${name}-${index}`,
        name,
        formattedTotal: formatPHP(total),
        barStyle: `--bar-color:${CHART_COLORS[index % CHART_COLORS.length]};--bar-width:${Math.round((total / max) * 100)}%`
    }));
}

export default class SpendlyApp extends LightningElement {
    _latestLoadRequestId = 0;

    activeView = 'dashboard';
    isSidebarCollapsed = false;
    startDate;
    endDate;
    expenseGroupId = 'All';
    categoryId = 'All';
    searchTerm = '';

    expenseGroupOptions = [{ label: 'All', value: 'All' }];
    categoryOptions = [{ label: 'All', value: 'All' }];

    allRows = [];
    selectedRows = [];
    monthlyTrendRaw = [];

    sortedBy = 'expenseDate';
    sortedDirection = 'desc';
    visibleCount = PAGE_SIZE;

    isLoading = false;
    isModalOpen = false;
    editRecordId = null;
    duplicateData = null;
    isColumnPickerOpen = false;
    dateError = '';

    columnVisibility = {
        expenseDate: true,
        transactionTimeDisplay: true,
        recordLink: true,
        category: true,
        expenseGroup: true,
        bank: true,
        transactionType: true,
        amount: true
    };

    get isDashboardView() {
        return this.activeView === 'dashboard';
    }

    get isTransactionsView() {
        return this.activeView === 'transactions';
    }

    get isRecurringView() {
        return this.activeView === 'recurring';
    }

    get isSettingsView() {
        return this.activeView === 'settings';
    }

    get workspaceNavItems() {
        return VIEW_CONFIG.map(view => ({
            ...view,
            className: this.getNavClass(view.key),
            ariaCurrent: this.activeView === view.key ? 'page' : null
        }));
    }

    get activeViewConfig() {
        return VIEW_CONFIG.find(view => view.key === this.activeView) || VIEW_CONFIG[0];
    }

    get viewTitle() {
        return this.activeViewConfig.title;
    }

    get viewSubtitle() {
        return this.activeViewConfig.subtitle;
    }

    get workspaceShellClass() {
        return `workspace-shell ${this.isSidebarCollapsed ? 'is-sidebar-collapsed' : ''}`;
    }

    get sidebarToggleTitle() {
        return this.isSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation';
    }

    get sidebarToggleIcon() {
        return this.isSidebarCollapsed ? 'utility:chevronright' : 'utility:chevronleft';
    }

    get sidebarAriaExpanded() {
        return String(!this.isSidebarCollapsed);
    }

    renderedCallback() {
        loadStyle(this, removeDateFormatStyle);
    }

    connectedCallback() {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

        this.startDate = formatDateISO(firstDay);
        this.endDate = formatDateISO(today);

        this.loadExpenses();
    }

    @wire(getAllExpenseGroups)
    wiredExpenseGroups({ error, data }) {
        if (data) {
            this.expenseGroupOptions = [
                { label: 'All', value: 'All' },
                ...data.map(expenseGroup => ({ label: expenseGroup.Name, value: expenseGroup.Id }))
            ];
        } else if (error) {
            this.showToast('Error', 'Failed to load expense groups.', 'error');
        }
    }

    @wire(getCategoriesByExpenseGroup, { expenseGroupId: '$expenseGroupId' })
    wiredCategories({ error, data }) {
        if (data) {
            this.categoryOptions = [
                { label: 'All', value: 'All' },
                ...data.map(category => ({ label: category.Name, value: category.Id }))
            ];
        } else if (error) {
            this.showToast('Error', 'Failed to load categories.', 'error');
        }
    }

    async loadExpenses() {
        const requestId = ++this._latestLoadRequestId;
        this.isLoading = true;
        this.selectedRows = [];

        try {
            const [data, trendData] = await Promise.all([
                getExpensesByFilters({
                    expenseGroupId: this.expenseGroupId,
                    categoryId: this.categoryId,
                    startDate: this.startDate,
                    endDate: this.endDate
                }),
                getMonthlyTrend({
                    expenseGroupId: this.expenseGroupId,
                    categoryId: this.categoryId,
                    startDate: this.startDate,
                    endDate: this.endDate
                })
            ]);

            if (requestId !== this._latestLoadRequestId) {
                return;
            }

            this.monthlyTrendRaw = trendData || [];
            this.allRows = data.map(row => ({
                id: row.Id,
                expenseDate: row.Expense_Date__c,
                transactionTime: row.Transaction_Time__c,
                transactionTimeDisplay: formatTime(row.Transaction_Time__c),
                name: row.Name,
                recordLink: `/${row.Id}`,
                category: row.Category__r?.Name,
                categoryId: row.Category__c,
                expenseGroup: row.Category__r?.Expense_Group__r?.Name,
                bank: row.Bank__c,
                transactionType: row.Transaction_Type__c,
                amount: row.Amount__c
            }));
            this.visibleCount = PAGE_SIZE;
        } catch (error) {
            if (requestId !== this._latestLoadRequestId) {
                return;
            }
            this.showToast('Error', 'Failed to load expenses.', 'error');
        } finally {
            if (requestId === this._latestLoadRequestId) {
                this.isLoading = false;
            }
        }
    }

    get filteredRows() {
        if (!this.searchTerm) {
            return this.allRows;
        }

        const term = this.searchTerm.toLowerCase();
        return this.allRows.filter(row =>
            (row.name || '').toLowerCase().includes(term) ||
            (row.category || '').toLowerCase().includes(term) ||
            (row.expenseGroup || '').toLowerCase().includes(term) ||
            (row.bank || '').toLowerCase().includes(term) ||
            (row.transactionType || '').toLowerCase().includes(term)
        );
    }

    get rowsToDisplay() {
        return this.filteredRows.slice(0, this.visibleCount);
    }

    get columns() {
        return ALL_COLUMNS.filter(column =>
            column.type === 'action' || this.columnVisibility[column.fieldName] !== false
        );
    }

    get columnPickerOptions() {
        return COLUMN_OPTIONS.map(column => ({
            key: column.key,
            label: column.label,
            checked: this.columnVisibility[column.key]
        }));
    }

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
        return formatPHP(this.totalAmount);
    }

    get expenseCount() {
        return this.filteredRows.length;
    }

    get transactionCountLabel() {
        const count = this.expenseCount;
        return `${count} transaction${count === 1 ? '' : 's'}`;
    }

    get visibleRowsSummary() {
        const visibleCount = Math.min(this.visibleCount, this.filteredRows.length);
        return `Showing ${visibleCount} of ${this.filteredRows.length}`;
    }

    get averageExpense() {
        if (this.filteredRows.length === 0) {
            return 'PHP 0.00';
        }
        return formatPHP(this.totalAmount / this.filteredRows.length);
    }

    get topCategory() {
        if (this.filteredRows.length === 0) {
            return { name: '-', amount: 'PHP 0.00' };
        }
        const [name, total] = groupByAmount(this.filteredRows, 'category')[0];
        return { name, amount: formatPHP(total) };
    }

    get topBank() {
        if (this.filteredRows.length === 0) {
            return { name: '-', count: 0 };
        }
        const [name, count] = groupByCount(this.filteredRows, 'bank')[0];
        return { name, count };
    }

    get categoryChartData() {
        if (this.filteredRows.length === 0) {
            return [];
        }
        const entries = groupByAmount(this.filteredRows, 'category').slice(0, 6);
        return buildBarChartData(entries, 'cat');
    }

    get bankChartData() {
        if (this.filteredRows.length === 0) {
            return [];
        }
        const entries = groupByAmount(this.filteredRows, 'bank');
        return buildBarChartData(entries, 'bank');
    }

    get monthlyTrendData() {
        const end = parseDateString(this.endDate) || new Date();
        const last6Months = Array.from({ length: 6 }, (_, index) => {
            const date = new Date(end.getFullYear(), end.getMonth() - (5 - index), 1);
            return { year: date.getFullYear(), monthNum: date.getMonth() + 1 };
        });

        const rawMap = {};
        this.monthlyTrendRaw.forEach(month => {
            rawMap[`${month.year}-${month.monthNum}`] = month.total || 0;
        });

        const totals = last6Months.map(month => rawMap[`${month.year}-${month.monthNum}`] || 0);
        const max = Math.max(...totals, 1);

        return last6Months.map((month, index) => ({
            key: `trend-${month.year}-${month.monthNum}`,
            label: MONTH_NAMES[month.monthNum - 1],
            barStyle: `--vbar-color:${CHART_COLORS[0]};--vbar-height:${Math.max(3, Math.round((totals[index] / max) * 110))}px`,
            hasValue: totals[index] > 0
        }));
    }

    get printDateRange() {
        return `${this.startDate || ''} - ${this.endDate || ''}`;
    }

    get transactionPeriodLabel() {
        const start = formatDate(this.startDate);
        const end = formatDate(this.endDate);

        if (start === '-' && end === '-') {
            return 'All dates';
        }

        return `${start} - ${end}`;
    }

    get printRows() {
        return this.filteredRows.map(row => ({
            ...row,
            expenseDateFormatted: formatDate(row.expenseDate),
            transactionTimeFormatted: row.transactionTimeDisplay,
            amountFormatted: row.amount != null ? formatPHP(row.amount) : '-'
        }));
    }

    handleChange(event) {
        const field = event.target.dataset.field;
        this[field] = event.detail.value;

        if (field === 'expenseGroupId') {
            this.categoryId = 'All';
        }

        if (field === 'startDate' || field === 'endDate') {
            this.validateDates();
            if (this.dateError) {
                return;
            }
        }

        this.loadExpenses();
    }

    handleSearch(event) {
        this.searchTerm = event.detail.value;
        this.visibleCount = PAGE_SIZE;
    }

    handleReset() {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

        this.startDate = formatDateISO(firstDay);
        this.endDate = formatDateISO(today);
        this.expenseGroupId = 'All';
        this.categoryId = 'All';
        this.searchTerm = '';
        this.loadExpenses();
    }

    validateDates() {
        if (this.startDate && this.endDate && this.startDate > this.endDate) {
            this.dateError = 'End Date cannot be before Start Date.';
        } else {
            this.dateError = '';
        }
    }

    handleViewChange(event) {
        this.activeView = event.currentTarget.dataset.view;
    }

    handleSidebarToggle() {
        this.isSidebarCollapsed = !this.isSidebarCollapsed;
    }

    getNavClass(viewName) {
        return `workspace-nav-item ${this.activeView === viewName ? 'is-active' : ''}`;
    }

    handleToggleColumnPicker() {
        this.isColumnPickerOpen = !this.isColumnPickerOpen;
    }

    handleColumnToggle(event) {
        const key = event.target.dataset.key;
        this.columnVisibility = { ...this.columnVisibility, [key]: event.target.checked };
    }

    handleRowSelection(event) {
        this.selectedRows = event.detail.selectedRows.map(row => row.id);
    }

    handleSort(event) {
        const { fieldName, sortDirection } = event.detail;
        this.sortedBy = fieldName;
        this.sortedDirection = sortDirection;

        const isAsc = sortDirection === 'asc';
        const sortField = fieldName === 'transactionTimeDisplay' ? 'transactionTime' : fieldName;
        this.allRows = [...this.allRows].sort((a, b) => {
            const left = a[sortField] || '';
            const right = b[sortField] || '';

            if (left === right) {
                return 0;
            }

            return left > right ? (isAsc ? 1 : -1) : (isAsc ? -1 : 1);
        });
    }

    async handleLoadMore() {
        if (this.visibleCount >= this.filteredRows.length) {
            return;
        }

        this.isLoading = true;
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        await new Promise(resolve => setTimeout(resolve, 500));
        this.visibleCount += LOAD_MORE_SIZE;
        this.isLoading = false;
    }

    async handleRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;
        const recordId = row.id;

        if (!recordId) {
            return;
        }

        if (actionName === 'edit') {
            this.duplicateData = null;
            this.editRecordId = recordId;
            this.isModalOpen = true;
            return;
        }

        if (actionName === 'duplicate') {
            this.editRecordId = null;
            this.duplicateData = {
                Name: `Copy of ${row.name}`,
                Amount__c: row.amount,
                Category__c: row.categoryId,
                Expense_Date__c: row.expenseDate,
                Transaction_Time__c: row.transactionTime,
                Transaction_Type__c: row.transactionType,
                Bank__c: row.bank
            };
            this.isModalOpen = true;
            return;
        }

        if (actionName === 'delete') {
            await this.confirmAndDeleteSingle(recordId);
        }
    }

    async confirmAndDeleteSingle(recordId) {
        const confirmed = await LightningConfirm.open({
            message: 'Are you sure you want to delete this expense?',
            variant: 'header',
            label: 'Confirm Deletion'
        });
        if (!confirmed) {
            return;
        }

        const index = this.allRows.findIndex(row => row.id === recordId);
        const removed = this.allRows[index];
        this.allRows = this.allRows.filter(row => row.id !== recordId);

        try {
            await deleteExpense({ expenseId: recordId });
            this.showToast('Deleted', 'Expense deleted successfully!', 'success');
        } catch (error) {
            this.allRows = [
                ...this.allRows.slice(0, index),
                removed,
                ...this.allRows.slice(index)
            ];
            this.showToast('Error', error?.body?.message || 'Failed to delete expense.', 'error');
        }
    }

    async handleBulkDelete() {
        const count = this.selectedRows.length;
        const confirmed = await LightningConfirm.open({
            message: `Are you sure you want to delete ${count} expense(s)?`,
            variant: 'header',
            label: 'Confirm Bulk Deletion'
        });
        if (!confirmed) {
            return;
        }

        const idsToDelete = [...this.selectedRows];
        const removedRows = this.allRows.filter(row => idsToDelete.includes(row.id));
        const removedIndexes = removedRows.map(row => this.allRows.findIndex(item => item.id === row.id));

        this.allRows = this.allRows.filter(row => !idsToDelete.includes(row.id));
        this.selectedRows = [];

        try {
            await deleteExpenses({ expenseIds: idsToDelete });
            this.showToast('Deleted', `${count} expense(s) deleted successfully!`, 'success');
        } catch (error) {
            const restored = [...this.allRows];
            removedRows.forEach((row, index) => {
                restored.splice(removedIndexes[index], 0, row);
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

    handlePrint() {
        window.print();
    }

    handleExportCsv() {
        if (this.hasNoRows) {
            return;
        }

        const headers = ['Date', 'Time', 'Expense Name', 'Category', 'Expense Group', 'Bank', 'Type', 'Amount (PHP)'];
        const rows = this.filteredRows.map(row => [
            row.expenseDate || '',
            row.transactionTimeDisplay === '-' ? '' : row.transactionTimeDisplay,
            row.name || '',
            row.category || '',
            row.expenseGroup || '',
            row.bank || '',
            row.transactionType || '',
            row.amount != null ? row.amount : ''
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const link = document.createElement('a');
        link.setAttribute('href', `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`);
        link.setAttribute('download', `spendly-expenses-${this.endDate || 'export'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
