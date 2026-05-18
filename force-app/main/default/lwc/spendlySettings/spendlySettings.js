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
    minute: '2-digit'
});

function formatDateTime(value) {
    return value ? DATE_TIME_FORMAT.format(new Date(value)) : '-';
}

export default class SpendlySettings extends LightningElement {
    settingsId;
    recurringExpensesEnabled = true;
    lastRunStatus = '-';
    lastRunDateTime;
    lastRunMessage = '-';

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

    get lastRecurringRunStatus() {
        return this.lastRunStatus || '-';
    }

    get lastRecurringRunDateTime() {
        return formatDateTime(this.lastRunDateTime);
    }

    get lastRecurringRunMessage() {
        return this.lastRunMessage || '-';
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

    async handleSave() {
        this.isSaving = true;
        try {
            const settings = await saveSettings({
                recurringExpensesEnabled: this.recurringExpensesEnabled
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
        this.lastRunStatus = settings?.lastRecurringRunStatus || '-';
        this.lastRunDateTime = settings?.lastRecurringRunDateTime;
        this.lastRunMessage = settings?.lastRecurringRunMessage || '-';
    }

    getErrorMessage(error, fallback) {
        return error?.body?.message || fallback;
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
