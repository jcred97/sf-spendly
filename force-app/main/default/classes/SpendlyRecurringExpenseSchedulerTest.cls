@IsTest
private class SpendlyRecurringExpenseSchedulerTest {
    @IsTest
    static void testScheduledRunStartsBatch() {
        Expense_Group__c expenseGroup = new Expense_Group__c(Name = 'Health');
        insert expenseGroup;

        Category__c category = new Category__c(
            Name = 'Fitness',
            Expense_Group__c = expenseGroup.Id
        );
        insert category;

        Date dueDate = Date.today();
        Recurring_Expense__c recurringExpense = new Recurring_Expense__c(
            Name = 'Gym',
            Active__c = true,
            Amount__c = 1500,
            Category__c = category.Id,
            Frequency__c = 'Monthly',
            Next_Run_Date__c = dueDate,
            Start_Date__c = dueDate
        );
        insert recurringExpense;

        Test.startTest();
        new SpendlyRecurringExpenseScheduler().execute(null);
        Test.stopTest();

        List<Expense__c> generatedExpenses = [
            SELECT Name, Expense_Date__c, Recurring_Expense__c
            FROM Expense__c
            WHERE Recurring_Expense__c = :recurringExpense.Id
        ];
        System.assertEquals(1, generatedExpenses.size(), 'The scheduled batch should create one due expense');
        System.assertEquals('Gym', generatedExpenses[0].Name);
        System.assertEquals(dueDate, generatedExpenses[0].Expense_Date__c);

        Recurring_Expense__c updatedRecurringExpense = [
            SELECT Next_Run_Date__c
            FROM Recurring_Expense__c
            WHERE Id = :recurringExpense.Id
        ];
        System.assertEquals(dueDate.addMonths(1), updatedRecurringExpense.Next_Run_Date__c);
    }

    @IsTest
    static void testScheduledRunSkipsWhenDisabled() {
        Expense_Group__c expenseGroup = new Expense_Group__c(Name = 'Health');
        insert expenseGroup;

        Category__c category = new Category__c(
            Name = 'Fitness',
            Expense_Group__c = expenseGroup.Id
        );
        insert category;

        Date dueDate = Date.today();
        Recurring_Expense__c recurringExpense = new Recurring_Expense__c(
            Name = 'Gym',
            Active__c = true,
            Amount__c = 1500,
            Category__c = category.Id,
            Frequency__c = 'Monthly',
            Next_Run_Date__c = dueDate,
            Start_Date__c = dueDate
        );
        insert recurringExpense;

        SpendlySettingsService.saveSettings(false);

        Test.startTest();
        new SpendlyRecurringExpenseScheduler().execute(null);
        Test.stopTest();

        System.assertEquals(0, [SELECT COUNT() FROM Expense__c], 'No expenses should generate when disabled');

        Spendly_Settings__c settings = [
            SELECT Last_Recurring_Run_Status__c
            FROM Spendly_Settings__c
            LIMIT 1
        ];
        System.assertEquals('Skipped', settings.Last_Recurring_Run_Status__c);
    }
}
