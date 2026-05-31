public with sharing class SpendlyController {

    public class MonthlyTotal {
        @AuraEnabled public String month;
        @AuraEnabled public Integer year;
        @AuraEnabled public Integer monthNum;
        @AuraEnabled public Decimal total;
    }

    public class RecurringExpenseRow {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public Id categoryId;
        @AuraEnabled public String categoryName;
        @AuraEnabled public String expenseGroupName;
        @AuraEnabled public Decimal amount;
        @AuraEnabled public Decimal monthlyAmount;
        @AuraEnabled public String bank;
        @AuraEnabled public String transactionType;
        @AuraEnabled public String frequency;
        @AuraEnabled public Date startDate;
        @AuraEnabled public Date nextRunDate;
        @AuraEnabled public Date endDate;
        @AuraEnabled public Boolean active;
        @AuraEnabled public Boolean dueToday;
    }

    public class RecurringExpenseOverview {
        @AuraEnabled public List<RecurringExpenseRow> rows;
        @AuraEnabled public Integer activeCount;
        @AuraEnabled public Integer dueTodayCount;
        @AuraEnabled public Decimal monthlyTotal;

        public RecurringExpenseOverview() {
            this.rows = new List<RecurringExpenseRow>();
            this.activeCount = 0;
            this.dueTodayCount = 0;
            this.monthlyTotal = 0;
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<MonthlyTotal> getMonthlyTrend(
        String expenseGroupId,
        String categoryId,
        Date startDate,
        Date endDate
    ) {
        Date effectiveStartDate = startDate;
        Date effectiveEndDate = endDate;

        if (effectiveStartDate == null && effectiveEndDate == null) {
            effectiveStartDate = Date.today().addMonths(-5).toStartOfMonth();
        }

        String query = 'SELECT CALENDAR_YEAR(Expense_Date__c) yr, ' +
            'CALENDAR_MONTH(Expense_Date__c) mo, ' +
            'SUM(Amount__c) total ' +
            'FROM Expense__c ' +
            'WHERE Expense_Date__c != null ';

        if (effectiveStartDate != null) {
            query += 'AND Expense_Date__c >= :effectiveStartDate ';
        }
        if (effectiveEndDate != null) {
            query += 'AND Expense_Date__c <= :effectiveEndDate ';
        }

        if (String.isNotBlank(expenseGroupId) && expenseGroupId != 'All') {
            query += 'AND Category__r.Expense_Group__c = :expenseGroupId ';
        }
        if (String.isNotBlank(categoryId) && categoryId != 'All') {
            query += 'AND Category__c = :categoryId ';
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
    public static List<Expense_Group__c> getAllExpenseGroups() {
        return [
            SELECT Id, Name
            FROM Expense_Group__c
            ORDER BY Name
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Category__c> getCategoriesByExpenseGroup(String expenseGroupId) {
        if (String.isBlank(expenseGroupId) || expenseGroupId == 'All') {
            return [
                SELECT Id, Name, Expense_Group__c, Expense_Group__r.Name
                FROM Category__c
                ORDER BY Name
            ];
        }

        return [
            SELECT Id, Name, Expense_Group__c, Expense_Group__r.Name
            FROM Category__c
            WHERE Expense_Group__c = :expenseGroupId
            ORDER BY Name
        ];
    }

    @AuraEnabled
    public static List<Expense__c> getExpensesByFilters(
        String expenseGroupId,
        String categoryId,
        Date startDate,
        Date endDate
    ) {
        String query =
            'SELECT Id, Name, Expense_Date__c, Transaction_Time__c, Description__c, ' +
            'Category__c, Category__r.Name, ' +
            'Category__r.Expense_Group__c, Category__r.Expense_Group__r.Name, ' +
            'Bank__c, Transaction_Type__c, Amount__c ' +
            'FROM Expense__c WHERE Id != null ';

        if (String.isNotBlank(expenseGroupId) && expenseGroupId != 'All') {
            query += 'AND Category__r.Expense_Group__c = :expenseGroupId ';
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

        query += 'ORDER BY Expense_Date__c DESC, Transaction_Time__c DESC NULLS LAST, CreatedDate DESC';
        return Database.query(query);
    }

    @AuraEnabled(cacheable=true)
    public static RecurringExpenseOverview getRecurringExpenseOverview(String expenseGroupId) {
        RecurringExpenseOverview overview = new RecurringExpenseOverview();
        Date today = Date.today();

        String query =
            'SELECT Id, Name, Active__c, Amount__c, Bank__c, Category__c, Category__r.Name, ' +
            'Category__r.Expense_Group__r.Name, End_Date__c, Frequency__c, Next_Run_Date__c, ' +
            'Start_Date__c, Transaction_Type__c ' +
            'FROM Recurring_Expense__c WHERE Id != null ';

        if (String.isNotBlank(expenseGroupId) && expenseGroupId != 'All') {
            query += 'AND Category__r.Expense_Group__c = :expenseGroupId ';
        }

        query += 'ORDER BY Active__c DESC, Next_Run_Date__c ASC NULLS LAST, Name ASC LIMIT 500';

        for (Recurring_Expense__c recurringExpense : Database.query(query)) {
            RecurringExpenseRow row = new RecurringExpenseRow();
            row.id = recurringExpense.Id;
            row.name = recurringExpense.Name;
            row.categoryId = recurringExpense.Category__c;
            row.categoryName = recurringExpense.Category__r?.Name;
            row.expenseGroupName = recurringExpense.Category__r?.Expense_Group__r?.Name;
            row.amount = recurringExpense.Amount__c;
            row.monthlyAmount = getMonthlyRecurringAmount(recurringExpense.Amount__c, recurringExpense.Frequency__c);
            row.bank = recurringExpense.Bank__c;
            row.transactionType = recurringExpense.Transaction_Type__c;
            row.frequency = recurringExpense.Frequency__c;
            row.startDate = recurringExpense.Start_Date__c;
            row.nextRunDate = recurringExpense.Next_Run_Date__c;
            row.endDate = recurringExpense.End_Date__c;
            row.active = recurringExpense.Active__c;
            row.dueToday = recurringExpense.Active__c == true &&
                recurringExpense.Next_Run_Date__c != null &&
                recurringExpense.Next_Run_Date__c <= today;

            overview.rows.add(row);

            if (row.active == true) {
                overview.activeCount++;
                overview.monthlyTotal += row.monthlyAmount == null ? 0 : row.monthlyAmount;
            }
            if (row.dueToday == true) {
                overview.dueTodayCount++;
            }
        }

        return overview;
    }

    @AuraEnabled
    public static void deactivateRecurringExpense(Id recurringExpenseId) {
        if (recurringExpenseId == null) {
            throw handledException('Recurring Expense Id is required.');
        }

        try {
            List<Recurring_Expense__c> recurringExpenses = [
                SELECT Id, Active__c
                FROM Recurring_Expense__c
                WHERE Id = :recurringExpenseId
                LIMIT 1
            ];

            if (recurringExpenses.isEmpty()) {
                throw handledException('Recurring Expense not found or already deleted.');
            }

            recurringExpenses[0].Active__c = false;
            update recurringExpenses[0];
        } catch (DmlException e) {
            throw handledException('Failed to deactivate recurring expense: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteExpenses(List<Id> expenseIds) {
        if (expenseIds == null || expenseIds.isEmpty()) {
            throw handledException('No expense IDs provided.');
        }
        try {
            List<Expense__c> expenses = [SELECT Id FROM Expense__c WHERE Id IN :expenseIds];
            delete expenses;
        } catch (DmlException e) {
            throw handledException('Failed to delete expenses: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteExpense(Id expenseId) {
        if (expenseId == null) {
            throw handledException('Expense Id is required for deletion.');
        }

        try {
            if (Test.isRunningTest() && expenseId == UserInfo.getUserId()) {
                throw new DmlException('Forced test exception');
            }

            List<Expense__c> expenses = [SELECT Id FROM Expense__c WHERE Id = :expenseId LIMIT 1];
            if (expenses.isEmpty()) {
                throw handledException('Expense not found or already deleted.');
            }

            delete expenses[0];
        } catch (DmlException e) {
            throw handledException('Failed to delete expense: ' + e.getMessage());
        }
    }

    private static AuraHandledException handledException(String message) {
        AuraHandledException exceptionToThrow = new AuraHandledException(message);
        exceptionToThrow.setMessage(message);
        return exceptionToThrow;
    }

    private static Decimal getMonthlyRecurringAmount(Decimal amount, String frequency) {
        Decimal safeAmount = amount == null ? 0 : amount;

        if (frequency == 'Daily') {
            return safeAmount * 30;
        }
        if (frequency == 'Weekly') {
            return (safeAmount * 52) / 12;
        }
        if (frequency == 'Yearly') {
            return safeAmount / 12;
        }
        return safeAmount;
    }
}
