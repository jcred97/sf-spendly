public with sharing class SpendlySettingsService {
    private static final String DEFAULT_SETTINGS_NAME = 'Default';

    public class SettingsState {
        @AuraEnabled public Id settingsId;
        @AuraEnabled public Boolean recurringExpensesEnabled;
        @AuraEnabled public Datetime lastRecurringRunDateTime;
        @AuraEnabled public String lastRecurringRunStatus;
        @AuraEnabled public String lastRecurringRunMessage;

        public SettingsState(Spendly_Settings__c settings) {
            this.settingsId = settings.Id;
            this.recurringExpensesEnabled = settings.Recurring_Expenses_Enabled__c;
            this.lastRecurringRunDateTime = settings.Last_Recurring_Run_DateTime__c;
            this.lastRecurringRunStatus = settings.Last_Recurring_Run_Status__c;
            this.lastRecurringRunMessage = settings.Last_Recurring_Run_Message__c;
        }
    }

    @AuraEnabled
    public static SettingsState getSettings() {
        return new SettingsState(getOrCreateSettings());
    }

    @AuraEnabled
    public static SettingsState saveSettings(Boolean recurringExpensesEnabled) {
        Spendly_Settings__c settings = getOrCreateSettings();
        settings.Recurring_Expenses_Enabled__c = recurringExpensesEnabled == null ? false : recurringExpensesEnabled;
        update settings;
        return new SettingsState(settings);
    }

    public static Boolean areRecurringExpensesEnabled() {
        return getOrCreateSettings().Recurring_Expenses_Enabled__c;
    }

    public static void markRecurringRunQueued(Id jobId) {
        updateRecurringRunStatus(
            'Queued',
            'Recurring expense generation queued. Job Id: ' + String.valueOf(jobId)
        );
    }

    public static void markRecurringRunCompleted(Integer expensesCreated, Integer recurringExpensesProcessed) {
        updateRecurringRunStatus(
            'Completed',
            'Created ' + String.valueOf(expensesCreated) +
                ' expense(s) from ' + String.valueOf(recurringExpensesProcessed) +
                ' recurring template(s).'
        );
    }

    public static void markRecurringRunSkipped(String message) {
        updateRecurringRunStatus('Skipped', message);
    }

    private static Spendly_Settings__c getOrCreateSettings() {
        List<Spendly_Settings__c> settingsRecords = [
            SELECT
                Id,
                Name,
                Recurring_Expenses_Enabled__c,
                Last_Recurring_Run_DateTime__c,
                Last_Recurring_Run_Status__c,
                Last_Recurring_Run_Message__c
            FROM Spendly_Settings__c
            ORDER BY CreatedDate ASC
            LIMIT 1
        ];

        if (!settingsRecords.isEmpty()) {
            return settingsRecords[0];
        }

        Spendly_Settings__c settings = new Spendly_Settings__c(
            Name = DEFAULT_SETTINGS_NAME,
            Recurring_Expenses_Enabled__c = true
        );
        insert settings;
        return settings;
    }

    private static void updateRecurringRunStatus(String status, String message) {
        Spendly_Settings__c settings = getOrCreateSettings();
        settings.Last_Recurring_Run_DateTime__c = System.now();
        settings.Last_Recurring_Run_Status__c = status;
        settings.Last_Recurring_Run_Message__c = message;
        update settings;
    }
}
