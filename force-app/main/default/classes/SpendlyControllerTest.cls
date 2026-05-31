@IsTest
private class SpendlyControllerTest {

    // ----------------------------
    // Test Data Factory
    // ----------------------------
    @testSetup
    static void setupData() {

        Expense_Group__c eg1 = new Expense_Group__c(Name = 'Food');
        Expense_Group__c eg2 = new Expense_Group__c(Name = 'Transport');
        insert new List<Expense_Group__c>{ eg1, eg2 };

        // Categories
        Category__c c1 = new Category__c(
            Name = 'Groceries',
            Expense_Group__c = eg1.Id
        );
        Category__c c2 = new Category__c(
            Name = 'Dining',
            Expense_Group__c = eg1.Id
        );
        Category__c c3 = new Category__c(
            Name = 'Taxi',
            Expense_Group__c = eg2.Id
        );
        insert new List<Category__c>{ c1, c2, c3 };

        // Expenses
        List<Expense__c> expenses = new List<Expense__c>{
            new Expense__c(
                Name = 'Expense 1',
                Category__c = c1.Id,
                Expense_Date__c = Date.today().addDays(-5),
                Amount__c = 100
            ),
            new Expense__c(
                Name = 'Expense 2',
                Category__c = c2.Id,
                Expense_Date__c = Date.today().addDays(-2),
                Amount__c = 200
            ),
            new Expense__c(
                Name = 'Expense 3',
                Category__c = c3.Id,
                Expense_Date__c = Date.today(),
                Amount__c = 300
            )
        };
        insert expenses;
    }

    @IsTest
    static void testGetAllExpenseGroups() {
        Test.startTest();
        List<Expense_Group__c> result = SpendlyController.getAllExpenseGroups();
        Test.stopTest();

        System.assertEquals(2, result.size(), 'Should return all expense groups');
    }

    @IsTest
    static void testGetCategories_ByExpenseGroup() {
        Expense_Group__c food = [SELECT Id FROM Expense_Group__c WHERE Name = 'Food' LIMIT 1];

        Test.startTest();
        List<Category__c> result = SpendlyController.getCategoriesByExpenseGroup(food.Id);
        Test.stopTest();

        System.assertEquals(2, result.size(), 'Food should have 2 categories');
    }

    // getExpensesByFilters() - No filters
    @IsTest
    static void testGetExpenses_NoFilters() {

        Test.startTest();
        List<Expense__c> result = SpendlyController.getExpensesByFilters('All', 'All', null, null);
        Test.stopTest();

        System.assertEquals(3, result.size(), 'Should return all expenses');
    }

    // getExpensesByFilters() - Expense Group Filter
    @IsTest
    static void testGetExpenses_ByExpenseGroup() {

        Expense_Group__c food = [SELECT Id FROM Expense_Group__c WHERE Name = 'Food' LIMIT 1];

        Test.startTest();
        List<Expense__c> result = SpendlyController.getExpensesByFilters(food.Id, 'All', null, null);
        Test.stopTest();

        System.assertEquals(2, result.size(), 'Food expense group should return 2 expenses');
    }

    // getExpensesByFilters() - Category + Date Filter
    @IsTest
    static void testGetExpenses_ByCategoryAndDate() {

        Category__c groceries = [SELECT Id FROM Category__c WHERE Name = 'Groceries' LIMIT 1];

        Date startDate = Date.today().addDays(-10);
        Date endDate   = Date.today().addDays(-1);

        Test.startTest();
        List<Expense__c> result = SpendlyController.getExpensesByFilters('All', groceries.Id, startDate, endDate);
        Test.stopTest();

        System.assertEquals(1, result.size(), 'Should return only Groceries expense');
    }

    @IsTest
    static void testGetExpenses_OrdersSameDayByTime() {
        Category__c groceries = [SELECT Id FROM Category__c WHERE Name = 'Groceries' LIMIT 1];
        Date expenseDate = Date.today().addDays(1);

        insert new List<Expense__c>{
            new Expense__c(
                Name = 'Morning Expense',
                Category__c = groceries.Id,
                Expense_Date__c = expenseDate,
                Transaction_Time__c = Time.newInstance(9, 0, 0, 0),
                Amount__c = 100
            ),
            new Expense__c(
                Name = 'Evening Expense',
                Category__c = groceries.Id,
                Expense_Date__c = expenseDate,
                Transaction_Time__c = Time.newInstance(18, 30, 0, 0),
                Amount__c = 200
            )
        };

        Test.startTest();
        List<Expense__c> result = SpendlyController.getExpensesByFilters('All', groceries.Id, expenseDate, expenseDate);
        Test.stopTest();

        System.assertEquals('Evening Expense', result[0].Name, 'Later same-day expense should sort first');
        System.assertEquals(Time.newInstance(18, 30, 0, 0), result[0].Transaction_Time__c);
    }

    // deleteExpense() - Success
    @IsTest
    static void testDeleteExpense_Success() {

        Expense__c exp = [SELECT Id FROM Expense__c LIMIT 1];

        Test.startTest();
        SpendlyController.deleteExpense(exp.Id);
        Test.stopTest();

        Integer count = [SELECT COUNT() FROM Expense__c WHERE Id = :exp.Id];

        System.assertEquals(0, count, 'Expense should be deleted');
    }

    // deleteExpense() - Null Id
    @IsTest
    static void testDeleteExpense_NullId() {

        Boolean exceptionThrown = false;

        try {
            Test.startTest();
            SpendlyController.deleteExpense(null);
            Test.stopTest();
        } catch (Exception e) {
            exceptionThrown = true;
        }

        System.assertEquals(true, exceptionThrown,'Exception should have been thrown for null Id');
    }

    // deleteExpenses() - Success
    @IsTest
    static void testDeleteExpenses_Success() {
        List<Expense__c> expenses = [SELECT Id FROM Expense__c LIMIT 2];
        List<Id> ids = new List<Id>{ expenses[0].Id, expenses[1].Id };

        Test.startTest();
        SpendlyController.deleteExpenses(ids);
        Test.stopTest();

        Integer count = [SELECT COUNT() FROM Expense__c WHERE Id IN :ids];
        System.assertEquals(0, count, 'Both expenses should be deleted');
    }

    // deleteExpenses() - Empty list
    @IsTest
    static void testDeleteExpenses_EmptyList() {
        Boolean exceptionThrown = false;
        try {
            Test.startTest();
            SpendlyController.deleteExpenses(new List<Id>());
            Test.stopTest();
        } catch (Exception e) {
            exceptionThrown = true;
        }
        System.assertEquals(true, exceptionThrown, 'Exception should be thrown for empty list');
    }

    // getMonthlyTrend() - All expense groups
    @IsTest
    static void testGetMonthlyTrend_All() {
        Test.startTest();
        List<SpendlyController.MonthlyTotal> result = SpendlyController.getMonthlyTrend('All', 'All', null, null);
        Test.stopTest();

        System.assert(result.size() > 0, 'Should return monthly trend data');
    }

    // getMonthlyTrend() - Specific expense group
    @IsTest
    static void testGetMonthlyTrend_ByExpenseGroup() {
        Expense_Group__c food = [SELECT Id FROM Expense_Group__c WHERE Name = 'Food' LIMIT 1];

        Test.startTest();
        List<SpendlyController.MonthlyTotal> result = SpendlyController.getMonthlyTrend(food.Id, 'All', null, null);
        Test.stopTest();

        System.assert(result != null, 'Should return trend data for expense group');
    }

    @IsTest
    static void testGetMonthlyTrend_ByCategoryAndDateRange() {
        Category__c groceries = [SELECT Id FROM Category__c WHERE Name = 'Groceries' LIMIT 1];

        Test.startTest();
        List<SpendlyController.MonthlyTotal> result = SpendlyController.getMonthlyTrend(
            'All',
            groceries.Id,
            Date.today().addDays(-10),
            Date.today().addDays(-1)
        );
        Test.stopTest();

        System.assertEquals(1, result.size(), 'Should return one monthly bucket for the filtered category');
        System.assertEquals(100, result[0].total, 'Trend total should match the filtered expense amount');
    }

    @IsTest
    static void testDeleteExpense_ForcedDmlFailure() {

        Boolean exceptionThrown = false;

        try {
            Test.startTest();
            // Passing UserId triggers forced exception
            SpendlyController.deleteExpense(UserInfo.getUserId());
            Test.stopTest();
        } catch (Exception e) {
            exceptionThrown = true;
        }

        System.assertEquals(true, exceptionThrown, 'Forced DML exception should have been thrown');
    }

    @IsTest
    static void testDeleteExpense_MissingRecord() {
        Expense__c exp = [SELECT Id FROM Expense__c LIMIT 1];
        delete exp;

        Boolean exceptionThrown = false;
        try {
            Test.startTest();
            SpendlyController.deleteExpense(exp.Id);
            Test.stopTest();
        } catch (AuraHandledException e) {
            exceptionThrown = true;
            System.assert(e.getMessage().contains('already deleted'), 'Should surface a friendly missing-record message');
        }

        System.assertEquals(true, exceptionThrown, 'Missing records should throw a handled exception');
    }

}
