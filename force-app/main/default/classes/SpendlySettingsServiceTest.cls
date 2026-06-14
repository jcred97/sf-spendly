@IsTest
private class SpendlySettingsServiceTest {
    @IsTest
    static void testGetSettingsCreatesDefaultRecord() {
        Test.startTest();
        SpendlySettingsService.SettingsState settings = SpendlySettingsService.getSettings();
        Test.stopTest();

        System.assertNotEquals(null, settings.settingsId);
        System.assertEquals(true, settings.recurringExpensesEnabled);
        System.assertEquals('08:00', settings.globalRecurringRunTime);
        System.assertEquals(false, settings.recurringScheduleActive);
        System.assertEquals('Not scheduled', settings.recurringScheduleState);
        System.assertEquals(null, settings.recurringScheduleNextRunDateTime);
        System.assertNotEquals(null, settings.recurringScheduleTimeZone);
        System.assertEquals(1, [SELECT COUNT() FROM Spendly_Settings__c]);
    }

    @IsTest
    static void testSaveSettingsUpdatesExistingRecord() {
        SpendlySettingsService.getSettings();

        Test.startTest();
        SpendlySettingsService.SettingsState settings = SpendlySettingsService.saveSettings(false);
        Test.stopTest();

        System.assertEquals(false, settings.recurringExpensesEnabled);
        System.assertEquals(false, SpendlySettingsService.areRecurringExpensesEnabled());
        System.assertEquals(1, [SELECT COUNT() FROM Spendly_Settings__c]);
    }

    @IsTest
    static void testSaveSettingsUpdatesGlobalRunTimeAndSchedule() {
        SpendlySettingsService.getSettings();

        SpendlySettingsService.SettingsState settings = SpendlySettingsService.saveSettings(true, '10:30');

        System.assertEquals('10:30', settings.globalRecurringRunTime);
        System.assertEquals(true, settings.recurringScheduleActive);
        System.assertEquals('WAITING', settings.recurringScheduleState);
        System.assertNotEquals(null, settings.recurringScheduleNextRunDateTime);
        System.assertNotEquals(null, settings.recurringScheduleTimeZone);
        System.assertEquals('0 30 10 * * ?', settings.recurringScheduleCronExpression);

        Spendly_Settings__c settingsRecord = [
            SELECT Global_Recurring_Run_Time__c
            FROM Spendly_Settings__c
            LIMIT 1
        ];
        System.assertEquals(Time.newInstance(10, 30, 0, 0), settingsRecord.Global_Recurring_Run_Time__c);

        CronTrigger scheduledJob = [
            SELECT CronExpression, CronJobDetail.Name
            FROM CronTrigger
            WHERE CronJobDetail.Name = 'Spendly Recurring Expense Daily'
            LIMIT 1
        ];
        System.assertEquals('0 30 10 * * ?', scheduledJob.CronExpression);
    }

    @IsTest
    static void testSingletonTriggerPreventsSecondRecord() {
        SpendlySettingsService.getSettings();

        Boolean exceptionThrown = false;
        try {
            insert new Spendly_Settings__c(
                Name = 'Second',
                Recurring_Expenses_Enabled__c = true
            );
        } catch (DmlException e) {
            exceptionThrown = true;
        }

        System.assertEquals(true, exceptionThrown, 'A second settings record should be blocked');
    }

    @IsTest
    static void testRunStatusUpdates() {
        Test.startTest();
        SpendlySettingsService.markRecurringRunQueued(UserInfo.getUserId());
        SpendlySettingsService.markRecurringRunCompleted(3, 2);
        Test.stopTest();

        Spendly_Settings__c settings = [
            SELECT
                Last_Recurring_Run_DateTime__c,
                Last_Recurring_Run_Status__c,
                Last_Recurring_Run_Message__c
            FROM Spendly_Settings__c
            LIMIT 1
        ];

        System.assertNotEquals(null, settings.Last_Recurring_Run_DateTime__c);
        System.assertEquals('Completed', settings.Last_Recurring_Run_Status__c);
        System.assert(settings.Last_Recurring_Run_Message__c.contains('Created 3 expenses from 2 recurring templates.'));
    }

    @IsTest
    static void testCompletedRunMessageWhenNothingIsDue() {
        Test.startTest();
        SpendlySettingsService.markRecurringRunCompleted(0, 0);
        Test.stopTest();

        Spendly_Settings__c settings = [
            SELECT Last_Recurring_Run_Message__c
            FROM Spendly_Settings__c
            LIMIT 1
        ];

        System.assertEquals('No recurring expenses were due.', settings.Last_Recurring_Run_Message__c);
    }
}
