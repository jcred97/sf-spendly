public with sharing class SpendlyRecurringExpenseService {
    @TestVisible
    private static final Integer MAX_EXPENSES_PER_RUN = 200;
    @TestVisible
    private static final Integer MAX_EXPENSES_PER_TRANSACTION = 9000;

    public class GenerationResult {
        @AuraEnabled public Date runDate;
        @AuraEnabled public Integer recurringExpensesProcessed;
        @AuraEnabled public Integer expensesCreated;
        @AuraEnabled public Integer recurringExpensesUpdated;
        @AuraEnabled public Boolean hitGenerationLimit;

        public GenerationResult(Date runDate) {
            this.runDate = runDate;
            this.recurringExpensesProcessed = 0;
            this.expensesCreated = 0;
            this.recurringExpensesUpdated = 0;
            this.hitGenerationLimit = false;
        }
    }

    @AuraEnabled
    public static GenerationResult generateDueExpenses() {
        return generateDueExpenses(Date.today());
    }

    @AuraEnabled
    public static Id runDueExpensesBatch() {
        return Database.executeBatch(
            new SpendlyRecurringExpenseBatch(),
            SpendlyRecurringExpenseBatch.DEFAULT_BATCH_SIZE
        );
    }

    @TestVisible
    private static GenerationResult generateDueExpenses(Date runDate) {
        if (runDate == null) {
            throw new AuraHandledException('Run date is required.');
        }

        List<Recurring_Expense__c> dueRecurringExpenses = [
            SELECT
                Id,
                Name,
                Active__c,
                Amount__c,
                Bank__c,
                Category__c,
                Description__c,
                End_Date__c,
                Frequency__c,
                Next_Run_Date__c,
                Start_Date__c,
                Transaction_Type__c
            FROM Recurring_Expense__c
            WHERE Active__c = true
                AND Next_Run_Date__c != null
                AND Next_Run_Date__c <= :runDate
            ORDER BY Next_Run_Date__c ASC, CreatedDate ASC
            LIMIT :MAX_EXPENSES_PER_RUN
        ];

        return generateDueExpenses(dueRecurringExpenses, runDate);
    }

    public static GenerationResult generateDueExpenses(
        List<Recurring_Expense__c> dueRecurringExpenses,
        Date runDate
    ) {
        return generateDueExpenses(dueRecurringExpenses, runDate, MAX_EXPENSES_PER_TRANSACTION);
    }

    private static GenerationResult generateDueExpenses(
        List<Recurring_Expense__c> dueRecurringExpenses,
        Date runDate,
        Integer maxExpenses
    ) {
        if (runDate == null) {
            throw new AuraHandledException('Run date is required.');
        }

        GenerationResult result = new GenerationResult(runDate);
        if (dueRecurringExpenses == null || dueRecurringExpenses.isEmpty()) {
            return result;
        }

        List<Expense__c> expensesToInsert = new List<Expense__c>();
        List<Recurring_Expense__c> recurringExpensesToUpdate = new List<Recurring_Expense__c>();

        for (Recurring_Expense__c recurringExpense : dueRecurringExpenses) {
            Boolean generatedForTemplate = false;
            Date dueDate = recurringExpense.Next_Run_Date__c;

            while (shouldGenerateForDate(recurringExpense, dueDate, runDate)) {
                if (expensesToInsert.size() >= maxExpenses) {
                    result.hitGenerationLimit = true;
                    break;
                }

                expensesToInsert.add(buildExpense(recurringExpense, dueDate));
                dueDate = getNextRunDate(dueDate, recurringExpense.Frequency__c, recurringExpense.Start_Date__c);
                recurringExpense.Next_Run_Date__c = dueDate;
                generatedForTemplate = true;
            }

            if (generatedForTemplate) {
                recurringExpensesToUpdate.add(recurringExpense);
            }

            if (result.hitGenerationLimit) {
                break;
            }
        }

        if (!expensesToInsert.isEmpty()) {
            insert expensesToInsert;
            result.expensesCreated = expensesToInsert.size();
        }

        if (!recurringExpensesToUpdate.isEmpty()) {
            update recurringExpensesToUpdate;
            result.recurringExpensesProcessed = recurringExpensesToUpdate.size();
            result.recurringExpensesUpdated = recurringExpensesToUpdate.size();
        }

        return result;
    }

    private static Boolean shouldGenerateForDate(
        Recurring_Expense__c recurringExpense,
        Date dueDate,
        Date runDate
    ) {
        return dueDate != null
            && dueDate <= runDate
            && (recurringExpense.End_Date__c == null || dueDate <= recurringExpense.End_Date__c);
    }

    private static Expense__c buildExpense(Recurring_Expense__c recurringExpense, Date dueDate) {
        return new Expense__c(
            Name = recurringExpense.Name,
            Amount__c = recurringExpense.Amount__c,
            Bank__c = recurringExpense.Bank__c,
            Category__c = recurringExpense.Category__c,
            Description__c = recurringExpense.Description__c,
            Expense_Date__c = dueDate,
            Recurring_Expense__c = recurringExpense.Id,
            Transaction_Type__c = recurringExpense.Transaction_Type__c
        );
    }

    private static Date getNextRunDate(Date dueDate, String frequency, Date anchorDate) {
        switch on frequency {
            when 'Daily' {
                return dueDate.addDays(1);
            }
            when 'Weekly' {
                return dueDate.addDays(7);
            }
            when 'Monthly' {
                Date nextMonth = dueDate.addMonths(1);
                Integer anchorDay = getAnchorDay(anchorDate, dueDate);
                return getAnchoredDate(nextMonth.year(), nextMonth.month(), anchorDay);
            }
            when 'Yearly' {
                Integer anchorDay = getAnchorDay(anchorDate, dueDate);
                Integer anchorMonth = anchorDate == null ? dueDate.month() : anchorDate.month();
                return getAnchoredDate(dueDate.year() + 1, anchorMonth, anchorDay);
            }
            when else {
                throw new AuraHandledException('Unsupported recurring expense frequency: ' + frequency);
            }
        }
    }

    private static Integer getAnchorDay(Date anchorDate, Date fallbackDate) {
        return anchorDate == null ? fallbackDate.day() : anchorDate.day();
    }

    private static Date getAnchoredDate(Integer year, Integer month, Integer anchorDay) {
        Integer day = Math.min(anchorDay, Date.daysInMonth(year, month));
        return Date.newInstance(year, month, day);
    }
}
