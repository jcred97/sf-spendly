@IsTest
private class SpendlyRecurringExpenseBatchTest {
    @IsTest
    static void testBatchProcessesMoreThanManualRunCap() {
        Expense_Group__c expenseGroup = new Expense_Group__c(Name = 'Health');
        insert expenseGroup;

        Category__c category = new Category__c(
            Name = 'Fitness',
            Expense_Group__c = expenseGroup.Id
        );
        insert category;

        Date dueDate = Date.newInstance(2026, 5, 1);
        List<Recurring_Expense__c> recurringExpenses = new List<Recurring_Expense__c>();
        for (Integer index = 0; index < 250; index++) {
            recurringExpenses.add(new Recurring_Expense__c(
                Name = 'Gym ' + index,
                Active__c = true,
                Amount__c = 1500,
                Category__c = category.Id,
                Frequency__c = 'Monthly',
                Next_Run_Date__c = dueDate,
                Start_Date__c = dueDate
            ));
        }
        insert recurringExpenses;

        Test.startTest();
        Database.executeBatch(
            new SpendlyRecurringExpenseBatch(Date.newInstance(2026, 5, 17)),
            250
        );
        Test.stopTest();

        Date expectedNextRunDate = Date.newInstance(2026, 6, 1);
        System.assertEquals(250, [SELECT COUNT() FROM Expense__c], 'All due recurring expenses should generate');
        System.assertEquals(
            250,
            [
                SELECT COUNT()
                FROM Recurring_Expense__c
                WHERE Next_Run_Date__c = :expectedNextRunDate
            ],
            'Every processed template should advance to the next monthly run date'
        );

        Spendly_Settings__c settings = [
            SELECT Last_Recurring_Run_Status__c, Last_Recurring_Run_Message__c
            FROM Spendly_Settings__c
            LIMIT 1
        ];
        System.assertEquals('Completed', settings.Last_Recurring_Run_Status__c);
        System.assert(
            settings.Last_Recurring_Run_Message__c.contains('Created 250 expenses'),
            'Batch finish should record the generated expense count'
        );
    }
}
