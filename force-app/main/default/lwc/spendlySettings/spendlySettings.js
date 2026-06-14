import { LightningElement } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import getSettings from '@salesforce/apex/SpendlySettingsService.getSettings';
import saveSettings from '@salesforce/apex/SpendlySettingsService.saveSettings';
import runDueExpensesBatch from '@salesforce/apex/SpendlyRecurringExpenseService.runDueExpensesBatch';

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
});

function formatDateTime(value) {
    return value ? DATE_TIME_FORMAT.format(new Date(value)) : '-';
}

export default class SpendlySettings extends LightningElement {
    settingsId;
    recurringExpensesEnabled = true;
    globalRecurringRunTime = '08:00';
    lastRunStatus = '-';
    lastRunDateTime;
    lastRunMessage = '-';
    scheduleActive = false;
    scheduleState = 'Not scheduled';
    scheduleNextRunDateTime;
    scheduleTimeZone = '-';
    scheduleCronExpression = '-';

    isLoading = true;
    isSaving = false;
    isRunning = false;

    connectedCallback() {
        this.loadSettings();
    }

    get runButtonLabel() {
        return this.isRunning ? 'Running...' : 'Run Recurring';
    }

    get isRunDisabled() {
        return this.isRunning || this.isSaving || !this.recurringExpensesEnabled;
    }

    get scheduleText() {
        return `Daily at ${this.formattedGlobalRunTime} (${this.scheduleTimeZoneDisplay})`;
    }

    get formattedGlobalRunTime() {
        const [hourValue, minuteValue] = (this.globalRecurringRunTime || '08:00').split(':');
        const date = new Date();
        date.setHours(Number(hourValue), Number(minuteValue), 0, 0);
        return new Intl.DateTimeFormat('en-PH', {
            hour: 'numeric',
            minute: '2-digit'
        }).format(date);
    }

    get lastRecurringRunStatus() {
        return this.lastRunStatus || '-';
    }

    get lastRecurringRunDateTime() {
        return formatDateTime(this.lastRunDateTime);
    }

    get lastRecurringRunMessage() {
        return this.lastRunMessage || '-';
    }

    get scheduleStatusLabel() {
        if (!this.recurringExpensesEnabled) {
            return 'Disabled';
        }

        return this.scheduleActive ? 'Scheduled' : 'Needs attention';
    }

    get scheduleStatusClass() {
        if (!this.recurringExpensesEnabled) {
            return 'status-pill status-pill_neutral';
        }

        return this.scheduleActive ? 'status-pill status-pill_success' : 'status-pill status-pill_warning';
    }

    get scheduleStateDisplay() {
        return this.scheduleState || 'Not scheduled';
    }

    get scheduleNextRunDisplay() {
        if (!this.recurringExpensesEnabled) {
            return 'Paused by setting';
        }

        return formatDateTime(this.scheduleNextRunDateTime);
    }

    get scheduleTimeZoneDisplay() {
        return this.scheduleTimeZone || '-';
    }

    async loadSettings() {
        this.isLoading = true;
        try {
            this.applySettings(await getSettings());
        } catch (error) {
            this.showToast('Error', this.getErrorMessage(error, 'Failed to load Spendly Settings.'), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    handleRecurringToggle(event) {
        this.recurringExpensesEnabled = event.target.checked;
    }

    handleGlobalRunTimeChange(event) {
        this.globalRecurringRunTime = event.target.value || '08:00';
    }

    async handleSave() {
        this.isSaving = true;
        try {
            const settings = await saveSettings({
                recurringExpensesEnabled: this.recurringExpensesEnabled,
                globalRecurringRunTime: this.globalRecurringRunTime
            });
            this.applySettings(settings);
            this.showToast('Saved', 'Spendly Settings saved.', 'success');
        } catch (error) {
            this.showToast('Error', this.getErrorMessage(error, 'Failed to save Spendly Settings.'), 'error');
        } finally {
            this.isSaving = false;
        }
    }

    async handleRunRecurringExpenses() {
        this.isRunning = true;
        try {
            await runDueExpensesBatch();
            this.showToast('Recurring run started', 'Due recurring expenses are being generated.', 'success');
            await this.loadSettings();
        } catch (error) {
            this.showToast(
                'Error',
                this.getErrorMessage(error, 'Failed to start recurring expense generation.'),
                'error'
            );
        } finally {
            this.isRunning = false;
        }
    }

    applySettings(settings) {
        this.settingsId = settings?.settingsId;
        this.recurringExpensesEnabled = settings?.recurringExpensesEnabled ?? true;
        this.globalRecurringRunTime = settings?.globalRecurringRunTime || '08:00';
        this.lastRunStatus = settings?.lastRecurringRunStatus || '-';
        this.lastRunDateTime = settings?.lastRecurringRunDateTime;
        this.lastRunMessage = settings?.lastRecurringRunMessage || '-';
        this.scheduleActive = settings?.recurringScheduleActive || false;
        this.scheduleState = settings?.recurringScheduleState || 'Not scheduled';
        this.scheduleNextRunDateTime = settings?.recurringScheduleNextRunDateTime;
        this.scheduleTimeZone = settings?.recurringScheduleTimeZone || '-';
        this.scheduleCronExpression = settings?.recurringScheduleCronExpression || '-';
    }

    getErrorMessage(error, fallback) {
        return error?.body?.message || fallback;
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
