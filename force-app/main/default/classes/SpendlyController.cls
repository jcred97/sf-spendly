public with sharing class SpendlyController {

    public class MonthlyTotal {
        @AuraEnabled public String month;
        @AuraEnabled public Integer year;
        @AuraEnabled public Integer monthNum;
        @AuraEnabled public Decimal total;
    }

    @AuraEnabled
    public static List<MonthlyTotal> getMonthlyTrend(String spendingId) {
        Date sixMonthsAgo = Date.today().addMonths(-5).toStartOfMonth();

        String query = 'SELECT CALENDAR_YEAR(Expense_Date__c) yr, ' +
            'CALENDAR_MONTH(Expense_Date__c) mo, ' +
            'SUM(Amount__c) total ' +
            'FROM Expense__c ' +
            'WHERE Expense_Date__c >= :sixMonthsAgo ' +
            'AND Expense_Date__c != null ';

        if (String.isNotBlank(spendingId) && spendingId != 'All') {
            query += 'AND Category__r.Spending__c = :spendingId ';
        }

        query += 'GROUP BY CALENDAR_YEAR(Expense_Date__c), CALENDAR_MONTH(Expense_Date__c) ' +
            'ORDER BY CALENDAR_YEAR(Expense_Date__c) ASC, CALENDAR_MONTH(Expense_Date__c) ASC';

        List<AggregateResult> results = Database.query(query);

        String[] monthNames = new String[]{
            'Jan','Feb','Mar','Apr','May','Jun',
            'Jul','Aug','Sep','Oct','Nov','Dec'
        };

        List<MonthlyTotal> trend = new List<MonthlyTotal>();
        for (AggregateResult ar : results) {
            MonthlyTotal mt = new MonthlyTotal();
            mt.year     = (Integer)ar.get('yr');
            mt.monthNum = (Integer)ar.get('mo');
            mt.month    = monthNames[mt.monthNum - 1];
            mt.total    = (Decimal)ar.get('total');
            trend.add(mt);
        }
        return trend;
    }


    @AuraEnabled(cacheable=true)
    public static List<Spending__c> getAllSpendings() {
        return [
            SELECT Id, Name
            FROM Spending__c
            ORDER BY Name
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Category__c> getCategoriesBySpending(String spendingId) {
        if (String.isBlank(spendingId) || spendingId == 'All') {
            return [
                SELECT Id, Name, Spending__c, Spending__r.Name
                FROM Category__c
                ORDER BY Name
            ];
        }

        return [
            SELECT Id, Name, Spending__c, Spending__r.Name
            FROM Category__c
            WHERE Spending__c = :spendingId
            ORDER BY Name
        ];
    }

    @AuraEnabled
    public static List<Expense__c> getExpensesByFilters(
        String spendingId,
        String categoryId,
        Date startDate,
        Date endDate
    ) {
        String query =
            'SELECT Id, Name, Expense_Date__c, Description__c, ' +
            'Category__c, Category__r.Name, ' +
            'Category__r.Spending__c, Category__r.Spending__r.Name, ' +
            'Bank__c, Transaction_Type__c, Amount__c ' +
            'FROM Expense__c WHERE Id != null ';

        if (String.isNotBlank(spendingId) && spendingId != 'All') {
            query += 'AND Category__r.Spending__c = :spendingId ';
        }
        if (String.isNotBlank(categoryId) && categoryId != 'All') {
            query += 'AND Category__c = :categoryId ';
        }
        if (startDate != null) {
            query += 'AND Expense_Date__c >= :startDate ';
        }
        if (endDate != null) {
            query += 'AND Expense_Date__c <= :endDate ';
        }

        query += 'ORDER BY Expense_Date__c DESC';
        return Database.query(query);
    }

    @AuraEnabled
    public static void deleteExpenses(List<Id> expenseIds) {
        if (expenseIds == null || expenseIds.isEmpty()) {
            throw new AuraHandledException('No expense IDs provided.');
        }
        try {
            List<Expense__c> expenses = [SELECT Id FROM Expense__c WHERE Id IN :expenseIds];
            delete expenses;
        } catch (DmlException e) {
            throw new AuraHandledException('Failed to delete expenses: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteExpense(Id expenseId) {
        if (expenseId == null) {
            throw new AuraHandledException('Expense Id is required for deletion.');
        }

        try {
            if (Test.isRunningTest() && expenseId == UserInfo.getUserId()) {
            throw new DmlException('Forced test exception');
        }
            Expense__c exp = [SELECT Id FROM Expense__c WHERE Id = :expenseId LIMIT 1];
            delete exp;
        } catch (DmlException e) {
            throw new AuraHandledException('Failed to delete expense: ' + e.getMessage());
        }
    }
}
