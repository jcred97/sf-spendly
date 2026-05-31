@IsTest
private class SpendlyRecurringExpenseServiceTest {
    @testSetup
    static void setupData() {
        Expense_Group__c expenseGroup = new Expense_Group__c(Name = 'Health');
        insert expenseGroup;

        Category__c category = new Category__c(
            Name = 'Fitness',
            Expense_Group__c = expenseGroup.Id
        );
        insert category;
    }

    @IsTest
    static void testGenerateDueExpenses_CatchesUpMonthlyExpenses() {
        Category__c category = [SELECT Id FROM Category__c WHERE Name = 'Fitness' LIMIT 1];
        Date firstDueDate = Date.newInstance(2026, 3, 1);
        Date runDate = Date.newInstance(2026, 5, 16);

        Recurring_Expense__c recurringExpense = new Recurring_Expense__c(
            Name = 'Gym',
            Active__c = true,
            Amount__c = 1500,
            Bank__c = 'BPI',
            Category__c = category.Id,
            Description__c = 'Monthly gym membership',
            Frequency__c = 'Monthly',
            Next_Run_Date__c = firstDueDate,
            Start_Date__c = firstDueDate,
            Transaction_Type__c = 'Debit Card'
        );
        insert recurringExpense;

        Test.startTest();
        SpendlyRecurringExpenseService.GenerationResult result =
            SpendlyRecurringExpenseService.generateDueExpenses(runDate);
        Test.stopTest();

        System.assertEquals(1, result.recurringExpensesProcessed, 'One recurring expense should be processed');
        System.assertEquals(3, result.expensesCreated, 'March, April, and May expenses should be created');
        System.assertEquals(false, result.hitGenerationLimit, 'The generation cap should not be hit');

        List<Expense__c> generatedExpenses = [
            SELECT
                Name,
                Amount__c,
                Bank__c,
                Category__c,
                Description__c,
                Expense_Date__c,
                Recurring_Expense__c,
                Transaction_Time__c,
                Transaction_Type__c
            FROM Expense__c
            WHERE Recurring_Expense__c = :recurringExpense.Id
            ORDER BY Expense_Date__c ASC
        ];

        System.assertEquals(3, generatedExpenses.size(), 'Three generated expenses should be linked to the template');
        System.assertEquals(Date.newInstance(2026, 3, 1), generatedExpenses[0].Expense_Date__c);
        System.assertEquals(Date.newInstance(2026, 4, 1), generatedExpenses[1].Expense_Date__c);
        System.assertEquals(Date.newInstance(2026, 5, 1), generatedExpenses[2].Expense_Date__c);
        System.assertEquals('Gym', generatedExpenses[0].Name);
        System.assertEquals(1500, generatedExpenses[0].Amount__c);
        System.assertEquals('BPI', generatedExpenses[0].Bank__c);
        System.assertNotEquals(null, generatedExpenses[0].Transaction_Time__c);
        System.assertEquals('Debit Card', generatedExpenses[0].Transaction_Type__c);

        Recurring_Expense__c updatedRecurringExpense = [
            SELECT Next_Run_Date__c
            FROM Recurring_Expense__c
            WHERE Id = :recurringExpense.Id
        ];
        System.assertEquals(Date.newInstance(2026, 6, 1), updatedRecurringExpense.Next_Run_Date__c);
    }

    @IsTest
    static void testGenerateDueExpenses_RespectsEndDate() {
        Category__c category = [SELECT Id FROM Category__c WHERE Name = 'Fitness' LIMIT 1];
        Date firstDueDate = Date.newInstance(2026, 1, 1);

        Recurring_Expense__c recurringExpense = new Recurring_Expense__c(
            Name = 'Limited Gym',
            Active__c = true,
            Amount__c = 1200,
            Category__c = category.Id,
            End_Date__c = Date.newInstance(2026, 1, 31),
            Frequency__c = 'Monthly',
            Next_Run_Date__c = firstDueDate,
            Start_Date__c = firstDueDate
        );
        insert recurringExpense;

        Test.startTest();
        SpendlyRecurringExpenseService.GenerationResult result =
            SpendlyRecurringExpenseService.generateDueExpenses(Date.newInstance(2026, 3, 1));
        Test.stopTest();

        System.assertEquals(1, result.expensesCreated, 'Only the January occurrence is within the end date');

        Recurring_Expense__c updatedRecurringExpense = [
            SELECT Next_Run_Date__c
            FROM Recurring_Expense__c
            WHERE Id = :recurringExpense.Id
        ];
        System.assertEquals(Date.newInstance(2026, 2, 1), updatedRecurringExpense.Next_Run_Date__c);
    }

    @IsTest
    static void testGenerateDueExpenses_MonthlyUsesStartDateAnchorDay() {
        Category__c category = [SELECT Id FROM Category__c WHERE Name = 'Fitness' LIMIT 1];
        Date firstDueDate = Date.newInstance(2026, 1, 30);

        Recurring_Expense__c recurringExpense = new Recurring_Expense__c(
            Name = 'Month End Gym',
            Active__c = true,
            Amount__c = 1500,
            Category__c = category.Id,
            Frequency__c = 'Monthly',
            Next_Run_Date__c = firstDueDate,
            Start_Date__c = firstDueDate
        );
        insert recurringExpense;

        Test.startTest();
        SpendlyRecurringExpenseService.GenerationResult result =
            SpendlyRecurringExpenseService.generateDueExpenses(Date.newInstance(2026, 3, 30));
        Test.stopTest();

        System.assertEquals(3, result.expensesCreated, 'January, February, and March should be generated');

        List<Expense__c> generatedExpenses = [
            SELECT Expense_Date__c
            FROM Expense__c
            WHERE Recurring_Expense__c = :recurringExpense.Id
            ORDER BY Expense_Date__c ASC
        ];

        System.assertEquals(Date.newInstance(2026, 1, 30), generatedExpenses[0].Expense_Date__c);
        System.assertEquals(Date.newInstance(2026, 2, 28), generatedExpenses[1].Expense_Date__c);
        System.assertEquals(Date.newInstance(2026, 3, 30), generatedExpenses[2].Expense_Date__c);

        Recurring_Expense__c updatedRecurringExpense = [
            SELECT Next_Run_Date__c
            FROM Recurring_Expense__c
            WHERE Id = :recurringExpense.Id
        ];
        System.assertEquals(Date.newInstance(2026, 4, 30), updatedRecurringExpense.Next_Run_Date__c);
    }

    @IsTest
    static void testGenerateDueExpenses_ContinuesFromNextRunDate() {
        Category__c category = [SELECT Id FROM Category__c WHERE Name = 'Fitness' LIMIT 1];

        Recurring_Expense__c recurringExpense = new Recurring_Expense__c(
            Name = 'Existing Gym',
            Active__c = true,
            Amount__c = 1500,
            Category__c = category.Id,
            Frequency__c = 'Monthly',
            Next_Run_Date__c = Date.newInstance(2026, 6, 1),
            Start_Date__c = Date.newInstance(2026, 1, 1)
        );
        insert recurringExpense;

        Test.startTest();
        SpendlyRecurringExpenseService.GenerationResult result =
            SpendlyRecurringExpenseService.generateDueExpenses(Date.newInstance(2026, 7, 16));
        Test.stopTest();

        System.assertEquals(2, result.expensesCreated, 'June and July should be generated after the last generated date');

        List<Expense__c> generatedExpenses = [
            SELECT Expense_Date__c
            FROM Expense__c
            WHERE Recurring_Expense__c = :recurringExpense.Id
            ORDER BY Expense_Date__c ASC
        ];
        System.assertEquals(Date.newInstance(2026, 6, 1), generatedExpenses[0].Expense_Date__c);
        System.assertEquals(Date.newInstance(2026, 7, 1), generatedExpenses[1].Expense_Date__c);

        Recurring_Expense__c updatedRecurringExpense = [
            SELECT Next_Run_Date__c
            FROM Recurring_Expense__c
            WHERE Id = :recurringExpense.Id
        ];
        System.assertEquals(Date.newInstance(2026, 8, 1), updatedRecurringExpense.Next_Run_Date__c);
    }

    @IsTest
    static void testGenerateDueExpenses_IgnoresInactiveAndFutureRecords() {
        Category__c category = [SELECT Id FROM Category__c WHERE Name = 'Fitness' LIMIT 1];
        Date runDate = Date.newInstance(2026, 5, 16);

        insert new List<Recurring_Expense__c>{
            new Recurring_Expense__c(
                Name = 'Inactive Gym',
                Active__c = false,
                Amount__c = 1500,
                Category__c = category.Id,
                Frequency__c = 'Monthly',
                Next_Run_Date__c = Date.newInstance(2026, 5, 1),
                Start_Date__c = Date.newInstance(2026, 5, 1)
            ),
            new Recurring_Expense__c(
                Name = 'Future Gym',
                Active__c = true,
                Amount__c = 1500,
                Category__c = category.Id,
                Frequency__c = 'Monthly',
                Next_Run_Date__c = Date.newInstance(2026, 6, 1),
                Start_Date__c = Date.newInstance(2026, 6, 1)
            )
        };

        Test.startTest();
        SpendlyRecurringExpenseService.GenerationResult result =
            SpendlyRecurringExpenseService.generateDueExpenses(runDate);
        Test.stopTest();

        System.assertEquals(0, result.expensesCreated, 'No expenses should be generated');
        System.assertEquals(0, [SELECT COUNT() FROM Expense__c], 'No expense records should be inserted');
    }

    @IsTest
    static void testRunDueExpensesBatchStartsBatch() {
        Category__c category = [SELECT Id FROM Category__c WHERE Name = 'Fitness' LIMIT 1];
        Date dueDate = Date.today();

        Recurring_Expense__c recurringExpense = new Recurring_Expense__c(
            Name = 'Manual Gym',
            Active__c = true,
            Amount__c = 1500,
            Category__c = category.Id,
            Frequency__c = 'Monthly',
            Next_Run_Date__c = dueDate,
            Start_Date__c = dueDate
        );
        insert recurringExpense;

        Id jobId;
        Test.startTest();
        jobId = SpendlyRecurringExpenseService.runDueExpensesBatch();
        Test.stopTest();

        System.assertNotEquals(null, jobId, 'The manual run should return the batch job id');
        System.assertEquals(
            1,
            [
                SELECT COUNT()
                FROM Expense__c
                WHERE Recurring_Expense__c = :recurringExpense.Id
            ],
            'The manual batch run should generate the due expense'
        );
    }

    @IsTest
    static void testRunDueExpensesBatchRespectsDisabledSetting() {
        SpendlySettingsService.saveSettings(false);

        Boolean exceptionThrown = false;
        try {
            Test.startTest();
            SpendlyRecurringExpenseService.runDueExpensesBatch();
            Test.stopTest();
        } catch (AuraHandledException e) {
            exceptionThrown = true;
        }

        System.assertEquals(true, exceptionThrown, 'Manual generation should be blocked when disabled');
    }

    @IsTest
    static void testGenerateDueExpenses_RequiresRunDate() {
        Boolean exceptionThrown = false;

        try {
            Test.startTest();
            SpendlyRecurringExpenseService.generateDueExpenses(null);
            Test.stopTest();
        } catch (AuraHandledException e) {
            exceptionThrown = true;
        }

        System.assertEquals(true, exceptionThrown, 'A null run date should throw a handled exception');
    }
}
