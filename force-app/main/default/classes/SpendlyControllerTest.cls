@IsTest
private class SpendlyControllerTest {

    // ----------------------------
    // Test Data Factory
    // ----------------------------
    @testSetup
    static void setupData() {

        // Spendings
        Spending__c s1 = new Spending__c(Name = 'Food');
        Spending__c s2 = new Spending__c(Name = 'Transport');
        insert new List<Spending__c>{ s1, s2 };

        // Categories
        Category__c c1 = new Category__c(
            Name = 'Groceries',
            Spending__c = s1.Id
        );
        Category__c c2 = new Category__c(
            Name = 'Dining',
            Spending__c = s1.Id
        );
        Category__c c3 = new Category__c(
            Name = 'Taxi',
            Spending__c = s2.Id
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

    // getAllSpendings()
    @IsTest
    static void testGetAllSpendings() {
        Test.startTest();
        List<Spending__c> result = SpendlyController.getAllSpendings();
        Test.stopTest();

        System.assertEquals(2, result.size(), 'Should return all spendings');
    }

    // getCategoriesBySpending() - All
    @IsTest
    static void testGetCategories_All() {
        Test.startTest();
        List<Category__c> result = SpendlyController.getCategoriesBySpending('All');
        Test.stopTest();

        System.assertEquals(3, result.size(), 'Should return all categories');
    }

    // getCategoriesBySpending() - Filtered
    @IsTest
    static void testGetCategories_BySpending() {

        Spending__c food = [SELECT Id FROM Spending__c WHERE Name = 'Food' LIMIT 1];

        Test.startTest();
        List<Category__c> result = SpendlyController.getCategoriesBySpending(food.Id);
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

    // getExpensesByFilters() - Spending Filter
    @IsTest
    static void testGetExpenses_BySpending() {

        Spending__c food = [SELECT Id FROM Spending__c WHERE Name = 'Food' LIMIT 1];

        Test.startTest();
        List<Expense__c> result = SpendlyController.getExpensesByFilters(food.Id, 'All', null, null);
        Test.stopTest();

        System.assertEquals(2, result.size(), 'Food spending should return 2 expenses');
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

}
