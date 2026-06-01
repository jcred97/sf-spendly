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
import getRecurringExpenseOverview from '@salesforce/apex/SpendlyController.getRecurringExpenseOverview';
import deactivateRecurringExpense from '@salesforce/apex/SpendlyController.deactivateRecurringExpense';
import runDueExpensesBatch from '@salesforce/apex/SpendlyRecurringExpenseService.runDueExpensesBatch';

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
        label: 'Expenses',
        title: 'Expenses',
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
const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'long'
});

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

function getMonthBounds(date) {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return {
        startDate: formatDateISO(firstDay),
        endDate: formatDateISO(lastDay)
    };
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
    expenseGroupId = '';
    categoryId = 'All';
    searchTerm = '';

    expenseGroups = [];
    expenseGroupOptions = [];
    categoryOptions = [{ label: 'All Categories', value: 'All' }];
    isExpenseGroupsLoaded = false;

    allRows = [];
    selectedRows = [];
    monthlyTrendRaw = [];
    recurringRows = [];
    recurringOverview = {
        activeCount: 0,
        dueTodayCount: 0,
        monthlyTotal: 0
    };

    visibleCount = PAGE_SIZE;

    isLoading = false;
    isRecurringLoading = false;
    isRunningRecurring = false;
    isModalOpen = false;
    editRecordId = null;
    duplicateData = null;
    dateError = '';

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

    get selectedExpenseGroupName() {
        return this.expenseGroups.find(expenseGroup => expenseGroup.Id === this.expenseGroupId)?.Name || '';
    }

    get categoryExpenseGroupId() {
        return this.expenseGroupId || undefined;
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
        const monthBounds = getMonthBounds(today);

        this.startDate = monthBounds.startDate;
        this.endDate = monthBounds.endDate;
    }

    @wire(getAllExpenseGroups)
    wiredExpenseGroups({ error, data }) {
        if (data) {
            this.isExpenseGroupsLoaded = true;
            this.expenseGroups = data;
            this.expenseGroupOptions = data.map(expenseGroup => ({
                label: expenseGroup.Name,
                value: expenseGroup.Id
            }));

            if (this.expenseGroupId && !data.some(expenseGroup => expenseGroup.Id === this.expenseGroupId)) {
                this.clearWorkspaceContext();
            }

            if (!this.expenseGroupId && data.length > 0) {
                this.setExpenseGroupContext(data[0].Id);
            }
        } else if (error) {
            this.isExpenseGroupsLoaded = true;
            this.showToast('Error', 'Failed to load expense groups.', 'error');
        }
    }

    @wire(getCategoriesByExpenseGroup, { expenseGroupId: '$categoryExpenseGroupId' })
    wiredCategories({ error, data }) {
        if (data) {
            this.categoryOptions = [
                { label: 'All Categories', value: 'All' },
                ...data.map(category => ({ label: category.Name, value: category.Id }))
            ];
        } else if (error) {
            this.showToast('Error', 'Failed to load categories.', 'error');
        }
    }

    async loadExpenses() {
        if (!this.expenseGroupId) {
            this.clearExpenseData();
            return;
        }

        const requestId = ++this._latestLoadRequestId;
        this.isLoading = true;
        this.selectedRows = [];

        try {
            const trendEndDate = parseDateString(this.endDate) || new Date();
            const trendStartDate = new Date(
                trendEndDate.getFullYear(),
                trendEndDate.getMonth() - 5,
                1
            );

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
                    startDate: formatDateISO(trendStartDate),
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
                expenseDateFormatted: formatDate(row.Expense_Date__c),
                transactionTime: row.Transaction_Time__c,
                transactionTimeDisplay: formatTime(row.Transaction_Time__c),
                name: row.Name,
                recordLink: `/${row.Id}`,
                category: row.Category__r?.Name,
                categoryId: row.Category__c,
                categoryDisplay: row.Category__r?.Name || 'Uncategorized',
                expenseGroup: row.Category__r?.Expense_Group__r?.Name,
                bank: row.Bank__c,
                bankDisplay: row.Bank__c || 'No bank',
                transactionType: row.Transaction_Type__c,
                transactionTypeDisplay: row.Transaction_Type__c || 'No type',
                amount: row.Amount__c,
                amountFormatted: formatPHP(row.Amount__c || 0)
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

    async loadRecurringExpenses() {
        if (!this.expenseGroupId) {
            this.clearRecurringData();
            return;
        }

        this.isRecurringLoading = true;

        try {
            const overview = await getRecurringExpenseOverview({
                expenseGroupId: this.expenseGroupId
            });
            this.recurringOverview = {
                activeCount: overview?.activeCount || 0,
                dueTodayCount: overview?.dueTodayCount || 0,
                monthlyTotal: overview?.monthlyTotal || 0
            };
            this.recurringRows = (overview?.rows || []).map(row => ({
                ...row,
                recordLink: `/${row.id}`,
                categoryDisplay: row.categoryName || 'Uncategorized',
                expenseGroupDisplay: row.expenseGroupName || 'No group',
                bankDisplay: row.bank || 'No bank',
                transactionTypeDisplay: row.transactionType || 'No type',
                amountFormatted: formatPHP(row.amount || 0),
                monthlyAmountFormatted: formatPHP(row.monthlyAmount || 0),
                startDateFormatted: formatDate(row.startDate),
                nextRunDateFormatted: formatDate(row.nextRunDate),
                endDateFormatted: formatDate(row.endDate),
                statusLabel: row.active ? 'Active' : 'Inactive',
                deactivateDisabled: !row.active,
                rowClass: `recurring-row ${row.dueToday ? 'is-due' : ''}`
            }));
        } catch (error) {
            this.showToast('Error', this.getErrorMessage(error, 'Failed to load recurring expenses.'), 'error');
        } finally {
            this.isRecurringLoading = false;
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

    get modalCategoryOptions() {
        return this.categoryOptions.filter(option => option.value !== 'All');
    }

    get transactionGroups() {
        const groups = [];
        const groupMap = new Map();
        const selectedIds = new Set(this.selectedRows);

        this.rowsToDisplay.forEach(row => {
            const key = row.expenseDate || 'no-date';
            if (!groupMap.has(key)) {
                const group = {
                    key,
                    label: row.expenseDateFormatted,
                    rows: [],
                    total: 0
                };
                groupMap.set(key, group);
                groups.push(group);
            }

            const group = groupMap.get(key);
            group.rows.push({
                ...row,
                isSelected: selectedIds.has(row.id)
            });
            group.total += row.amount || 0;
        });

        return groups.map(group => ({
            ...group,
            countLabel: `${group.rows.length} expense${group.rows.length === 1 ? '' : 's'}`,
            totalFormatted: formatPHP(group.total)
        }));
    }

    get hasNoRows() {
        return this.filteredRows.length === 0 && !this.isLoading;
    }

    get hasMoreRows() {
        return this.visibleCount < this.filteredRows.length;
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
        return `${count} expense${count === 1 ? '' : 's'}`;
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

    get dashboardTitle() {
        return `${this.selectedMonthLabel} spending`;
    }

    get dashboardSubtitle() {
        return `${this.selectedExpenseGroupName || 'No group selected'} / ${this.transactionPeriodLabel}`;
    }

    get largestExpense() {
        if (this.filteredRows.length === 0) {
            return { name: '-', amount: 'PHP 0.00', meta: 'No expenses yet' };
        }

        const row = [...this.filteredRows].sort((a, b) => (b.amount || 0) - (a.amount || 0))[0];
        return {
            name: row.name || 'Untitled expense',
            amount: formatPHP(row.amount || 0),
            meta: `${row.categoryDisplay} / ${row.expenseDateFormatted}`
        };
    }

    get topDay() {
        if (this.filteredRows.length === 0) {
            return { label: '-', amount: 'PHP 0.00', countLabel: 'No activity' };
        }

        const dayMap = new Map();
        this.filteredRows.forEach(row => {
            const key = row.expenseDate || 'no-date';
            const item = dayMap.get(key) || {
                label: row.expenseDateFormatted,
                total: 0,
                count: 0
            };
            item.total += row.amount || 0;
            item.count += 1;
            dayMap.set(key, item);
        });

        const top = [...dayMap.values()].sort((a, b) => b.total - a.total)[0];
        return {
            label: top.label,
            amount: formatPHP(top.total),
            countLabel: `${top.count} expense${top.count === 1 ? '' : 's'}`
        };
    }

    get dailyAverage() {
        if (this.filteredRows.length === 0) {
            return 'PHP 0.00';
        }

        const activeDays = new Set(this.filteredRows.map(row => row.expenseDate || 'no-date')).size || 1;
        return formatPHP(this.totalAmount / activeDays);
    }

    get dashboardInsights() {
        return [
            {
                key: 'largest',
                iconName: 'utility:arrowup',
                label: 'Largest expense',
                value: this.largestExpense.amount,
                detail: this.largestExpense.name
            },
            {
                key: 'top-day',
                iconName: 'utility:event',
                label: 'Highest day',
                value: this.topDay.amount,
                detail: `${this.topDay.label} / ${this.topDay.countLabel}`
            },
            {
                key: 'daily-average',
                iconName: 'utility:metrics',
                label: 'Active-day average',
                value: this.dailyAverage,
                detail: 'Based on days with expenses'
            },
            {
                key: 'top-category',
                iconName: 'utility:topic',
                label: 'Top category',
                value: this.topCategory.name,
                detail: this.topCategory.amount
            }
        ];
    }

    get recentDashboardRows() {
        return this.filteredRows.slice(0, 5).map(row => ({
            ...row,
            metaLine: `${row.categoryDisplay} / ${row.bankDisplay}`
        }));
    }

    get hasRecentDashboardRows() {
        return this.recentDashboardRows.length > 0;
    }

    get hasRecurringRows() {
        return this.recurringRows.length > 0;
    }

    get recurringCountLabel() {
        const count = this.recurringRows.length;
        return `${count} recurring expense${count === 1 ? '' : 's'}`;
    }

    get activeRecurringCount() {
        return this.recurringOverview.activeCount || 0;
    }

    get dueRecurringCount() {
        return this.recurringOverview.dueTodayCount || 0;
    }

    get recurringMonthlyTotal() {
        return formatPHP(this.recurringOverview.monthlyTotal || 0);
    }

    get recurringSummaryCards() {
        return [
            {
                key: 'active',
                label: 'Active templates',
                value: this.activeRecurringCount,
                detail: `${this.recurringRows.length} total templates`
            },
            {
                key: 'due',
                label: 'Due today',
                value: this.dueRecurringCount,
                detail: 'Ready for the next batch run'
            },
            {
                key: 'monthly',
                label: 'Monthly estimate',
                value: this.recurringMonthlyTotal,
                detail: 'Normalized active recurring total'
            }
        ];
    }

    get runRecurringLabel() {
        return this.isRunningRecurring ? 'Running...' : 'Run Recurring';
    }

    get isRunRecurringDisabled() {
        return this.isRunningRecurring || this.isRecurringLoading;
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
            formattedTotal: formatPHP(totals[index]),
            barClass: `vbar-item ${month.year === end.getFullYear() && month.monthNum === end.getMonth() + 1 ? 'is-selected' : ''}`,
            barStyle: `--vbar-color:${CHART_COLORS[0]};--vbar-height:${totals[index] > 0 ? Math.max(10, Math.round((totals[index] / max) * 110)) : 2}px`,
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

    get selectedMonthLabel() {
        const selectedDate = parseDateString(this.startDate) || new Date();
        return MONTH_LABEL_FORMAT.format(selectedDate);
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
        const monthBounds = getMonthBounds(today);

        this.startDate = monthBounds.startDate;
        this.endDate = monthBounds.endDate;
        this.categoryId = 'All';
        this.searchTerm = '';
        this.dateError = '';
        this.visibleCount = PAGE_SIZE;
        this.loadExpenses();
    }

    handlePreviousMonth() {
        this.setTransactionMonth(-1);
    }

    handleNextMonth() {
        this.setTransactionMonth(1);
    }

    setTransactionMonth(monthOffset) {
        const selectedDate = parseDateString(this.startDate) || new Date();
        const targetMonth = new Date(
            selectedDate.getFullYear(),
            selectedDate.getMonth() + monthOffset,
            1
        );
        const monthBounds = getMonthBounds(targetMonth);

        this.startDate = monthBounds.startDate;
        this.endDate = monthBounds.endDate;
        this.dateError = '';
        this.visibleCount = PAGE_SIZE;
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

        if (this.isRecurringView) {
            this.loadRecurringExpenses();
        }
    }

    handleWorkspaceGroupChange(event) {
        this.setExpenseGroupContext(event.detail.value);
    }

    setExpenseGroupContext(expenseGroupId) {
        if (!expenseGroupId || expenseGroupId === this.expenseGroupId) {
            return;
        }

        this.expenseGroupId = expenseGroupId;
        this.categoryId = 'All';
        this.searchTerm = '';
        this.activeView = 'dashboard';
        this.loadExpenses();
        this.loadRecurringExpenses();
    }

    clearWorkspaceContext() {
        this.expenseGroupId = '';
        this.categoryId = 'All';
        this.categoryOptions = [{ label: 'All Categories', value: 'All' }];
        this.searchTerm = '';
        this.activeView = 'dashboard';
        this.clearExpenseData();
        this.clearRecurringData();
    }

    clearExpenseData() {
        this._latestLoadRequestId += 1;
        this.allRows = [];
        this.selectedRows = [];
        this.monthlyTrendRaw = [];
        this.visibleCount = PAGE_SIZE;
        this.isLoading = false;
    }

    clearRecurringData() {
        this.recurringRows = [];
        this.recurringOverview = {
            activeCount: 0,
            dueTodayCount: 0,
            monthlyTotal: 0
        };
        this.isRecurringLoading = false;
    }

    handleSidebarToggle() {
        this.isSidebarCollapsed = !this.isSidebarCollapsed;
    }

    getNavClass(viewName) {
        return `workspace-nav-item ${this.activeView === viewName ? 'is-active' : ''}`;
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

    handleTransactionSelect(event) {
        const { id } = event.target.dataset;
        const selectedRows = new Set(this.selectedRows);

        if (event.target.checked) {
            selectedRows.add(id);
        } else {
            selectedRows.delete(id);
        }

        this.selectedRows = [...selectedRows];
    }

    async handleTransactionAction(event) {
        const { action, id } = event.currentTarget.dataset;
        const row = this.allRows.find(item => item.id === id);
        await this.performRowAction(action, row);
    }

    async handleRecurringAction(event) {
        const { action, id } = event.currentTarget.dataset;

        if (action === 'edit') {
            window.open(`/${id}`, '_blank', 'noopener');
            return;
        }

        if (action === 'deactivate') {
            await this.confirmAndDeactivateRecurring(id);
        }
    }

    async handleRunRecurringExpenses() {
        this.isRunningRecurring = true;
        try {
            await runDueExpensesBatch();
            this.showToast('Recurring run started', 'Due recurring expenses are being generated.', 'success');
            await Promise.all([
                this.loadRecurringExpenses(),
                this.loadExpenses()
            ]);
        } catch (error) {
            this.showToast(
                'Error',
                this.getErrorMessage(error, 'Failed to start recurring expense generation.'),
                'error'
            );
        } finally {
            this.isRunningRecurring = false;
        }
    }

    async confirmAndDeactivateRecurring(recordId) {
        const confirmed = await LightningConfirm.open({
            message: 'Deactivate this recurring expense template?',
            variant: 'header',
            label: 'Deactivate Recurring Expense'
        });
        if (!confirmed) {
            return;
        }

        try {
            await deactivateRecurringExpense({ recurringExpenseId: recordId });
            this.showToast('Deactivated', 'Recurring expense deactivated.', 'success');
            await this.loadRecurringExpenses();
        } catch (error) {
            this.showToast(
                'Error',
                this.getErrorMessage(error, 'Failed to deactivate recurring expense.'),
                'error'
            );
        }
    }

    async performRowAction(actionName, row) {
        if (!row) {
            return;
        }

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

    getErrorMessage(error, fallback) {
        return error?.body?.message || fallback;
    }
}
