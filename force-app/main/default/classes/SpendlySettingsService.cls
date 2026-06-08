public with sharing class SpendlySettingsService {
    private static final String DEFAULT_SETTINGS_NAME = 'Default';
    private static final String RECURRING_SCHEDULE_NAME = 'Spendly Recurring Expense Daily';
    private static final Time DEFAULT_RECURRING_RUN_TIME = Time.newInstance(8, 0, 0, 0);

    public class SettingsState {
        @AuraEnabled public Id settingsId;
        @AuraEnabled public Boolean recurringExpensesEnabled;
        @AuraEnabled public String globalRecurringRunTime;
        @AuraEnabled public Datetime lastRecurringRunDateTime;
        @AuraEnabled public String lastRecurringRunStatus;
        @AuraEnabled public String lastRecurringRunMessage;

        public SettingsState(Spendly_Settings__c settings) {
            this.settingsId = settings.Id;
            this.recurringExpensesEnabled = settings.Recurring_Expenses_Enabled__c;
            this.globalRecurringRunTime = formatRunTime(getEffectiveRunTime(settings.Global_Recurring_Run_Time__c));
            this.lastRecurringRunDateTime = settings.Last_Recurring_Run_DateTime__c;
            this.lastRecurringRunStatus = settings.Last_Recurring_Run_Status__c;
            this.lastRecurringRunMessage = settings.Last_Recurring_Run_Message__c;
        }
    }

    @AuraEnabled
    public static SettingsState getSettings() {
        return new SettingsState(getOrCreateSettings());
    }

    public static SettingsState saveSettings(Boolean recurringExpensesEnabled) {
        Spendly_Settings__c settings = getOrCreateSettings();
        return saveSettings(
            recurringExpensesEnabled,
            formatRunTime(getEffectiveRunTime(settings.Global_Recurring_Run_Time__c))
        );
    }

    @AuraEnabled
    public static SettingsState saveSettings(Boolean recurringExpensesEnabled, String globalRecurringRunTime) {
        Spendly_Settings__c settings = getOrCreateSettings();
        Time originalRunTime = getEffectiveRunTime(settings.Global_Recurring_Run_Time__c);
        Time requestedRunTime = parseRunTime(globalRecurringRunTime);
        settings.Recurring_Expenses_Enabled__c = recurringExpensesEnabled == null ? false : recurringExpensesEnabled;
        settings.Global_Recurring_Run_Time__c = requestedRunTime;
        update settings;

        if (originalRunTime != requestedRunTime) {
            rescheduleRecurringExpenses(requestedRunTime);
        }

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
                Global_Recurring_Run_Time__c,
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
            Recurring_Expenses_Enabled__c = true,
            Global_Recurring_Run_Time__c = DEFAULT_RECURRING_RUN_TIME
        );
        insert settings;
        return settings;
    }

    private static Time getEffectiveRunTime(Time runTime) {
        return runTime == null ? DEFAULT_RECURRING_RUN_TIME : runTime;
    }

    private static Time parseRunTime(String runTimeValue) {
        if (String.isBlank(runTimeValue)) {
            return DEFAULT_RECURRING_RUN_TIME;
        }

        List<String> parts = runTimeValue.split(':');
        if (parts.size() < 2) {
            throw new AuraHandledException('Enter a valid recurring run time.');
        }

        try {
            Integer hour = Integer.valueOf(parts[0]);
            Integer minute = Integer.valueOf(parts[1]);
            if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
                throw new AuraHandledException('Enter a valid recurring run time.');
            }
            return Time.newInstance(hour, minute, 0, 0);
        } catch (Exception e) {
            throw new AuraHandledException('Enter a valid recurring run time.');
        }
    }

    private static String formatRunTime(Time runTime) {
        return String.valueOf(runTime.hour()).leftPad(2, '0') + ':' +
            String.valueOf(runTime.minute()).leftPad(2, '0');
    }

    private static String buildDailyCron(Time runTime) {
        Time effectiveRunTime = getEffectiveRunTime(runTime);
        return '0 ' + String.valueOf(effectiveRunTime.minute()) + ' ' +
            String.valueOf(effectiveRunTime.hour()) + ' * * ?';
    }

    private static void rescheduleRecurringExpenses(Time runTime) {
        List<CronTrigger> existingJobs = [
            SELECT Id
            FROM CronTrigger
            WHERE CronJobDetail.Name = :RECURRING_SCHEDULE_NAME
        ];

        for (CronTrigger existingJob : existingJobs) {
            System.abortJob(existingJob.Id);
        }

        System.schedule(
            RECURRING_SCHEDULE_NAME,
            buildDailyCron(runTime),
            new SpendlyRecurringExpenseScheduler()
        );
    }

    private static void updateRecurringRunStatus(String status, String message) {
        Spendly_Settings__c settings = getOrCreateSettings();
        settings.Last_Recurring_Run_DateTime__c = System.now();
        settings.Last_Recurring_Run_Status__c = status;
        settings.Last_Recurring_Run_Message__c = message;
        update settings;
    }
}
