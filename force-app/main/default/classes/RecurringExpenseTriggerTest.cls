@IsTest
private class RecurringExpenseTriggerTest {
    @testSetup
    static void setupData() {
        Spending__c spending = new Spending__c(Name = 'Health');
        insert spending;

        Category__c category = new Category__c(
            Name = 'Fitness',
            Spending__c = spending.Id
        );
        insert category;
    }

    @IsTest
    static void testInsertDefaultsNextRunDateFromStartDate() {
        Category__c category = [SELECT Id FROM Category__c WHERE Name = 'Fitness' LIMIT 1];
        Date startDate = Date.newInstance(2026, 6, 1);

        Recurring_Expense__c recurringExpense = new Recurring_Expense__c(
            Name = 'Gym',
            Active__c = true,
            Amount__c = 2850,
            Category__c = category.Id,
            Frequency__c = 'Monthly',
            Start_Date__c = startDate
        );

        Test.startTest();
        insert recurringExpense;
        Test.stopTest();

        Recurring_Expense__c insertedRecurringExpense = [
            SELECT Next_Run_Date__c
            FROM Recurring_Expense__c
            WHERE Id = :recurringExpense.Id
        ];
        System.assertEquals(startDate, insertedRecurringExpense.Next_Run_Date__c);
    }

    @IsTest
    static void testUpdateKeepsNextRunDateAlignedBeforeGeneration() {
        Category__c category = [SELECT Id FROM Category__c WHERE Name = 'Fitness' LIMIT 1];

        Recurring_Expense__c recurringExpense = new Recurring_Expense__c(
            Name = 'Gym',
            Active__c = true,
            Amount__c = 2850,
            Category__c = category.Id,
            Frequency__c = 'Monthly',
            Start_Date__c = Date.newInstance(2026, 6, 1)
        );
        insert recurringExpense;

        recurringExpense = [
            SELECT Start_Date__c, Next_Run_Date__c
            FROM Recurring_Expense__c
            WHERE Id = :recurringExpense.Id
        ];

        Date updatedStartDate = Date.newInstance(2026, 7, 1);
        recurringExpense.Start_Date__c = updatedStartDate;

        Test.startTest();
        update recurringExpense;
        Test.stopTest();

        Recurring_Expense__c updatedRecurringExpense = [
            SELECT Next_Run_Date__c
            FROM Recurring_Expense__c
            WHERE Id = :recurringExpense.Id
        ];
        System.assertEquals(updatedStartDate, updatedRecurringExpense.Next_Run_Date__c);
    }

    @IsTest
    static void testUpdateDoesNotMoveAdvancedNextRunDate() {
        Category__c category = [SELECT Id FROM Category__c WHERE Name = 'Fitness' LIMIT 1];
        Date nextRunDate = Date.newInstance(2026, 7, 1);

        Recurring_Expense__c recurringExpense = new Recurring_Expense__c(
            Name = 'Gym',
            Active__c = true,
            Amount__c = 2850,
            Category__c = category.Id,
            Frequency__c = 'Monthly',
            Next_Run_Date__c = nextRunDate,
            Start_Date__c = Date.newInstance(2026, 6, 1)
        );
        insert recurringExpense;

        recurringExpense.Start_Date__c = Date.newInstance(2026, 5, 1);

        Test.startTest();
        update recurringExpense;
        Test.stopTest();

        Recurring_Expense__c updatedRecurringExpense = [
            SELECT Next_Run_Date__c
            FROM Recurring_Expense__c
            WHERE Id = :recurringExpense.Id
        ];
        System.assertEquals(nextRunDate, updatedRecurringExpense.Next_Run_Date__c);
    }
}
