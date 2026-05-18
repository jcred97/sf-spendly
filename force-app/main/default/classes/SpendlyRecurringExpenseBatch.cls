public with sharing class SpendlyRecurringExpenseBatch implements Database.Batchable<SObject>, Database.Stateful {
    public static final Integer DEFAULT_BATCH_SIZE = 50;

    private Date runDate;
    private Integer totalExpensesCreated = 0;
    private Integer totalRecurringExpensesProcessed = 0;

    public SpendlyRecurringExpenseBatch() {
        this(Date.today());
    }

    @TestVisible
    private SpendlyRecurringExpenseBatch(Date runDate) {
        if (runDate == null) {
            throw new AuraHandledException('Run date is required.');
        }
        this.runDate = runDate;
    }

    public Database.QueryLocator start(Database.BatchableContext context) {
        return Database.getQueryLocator([
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
        ]);
    }

    public void execute(Database.BatchableContext context, List<SObject> scope) {
        List<Recurring_Expense__c> recurringExpenses = new List<Recurring_Expense__c>();
        for (SObject item : scope) {
            recurringExpenses.add((Recurring_Expense__c)item);
        }

        SpendlyRecurringExpenseService.GenerationResult result =
            SpendlyRecurringExpenseService.generateDueExpenses(recurringExpenses, runDate);
        totalExpensesCreated += result.expensesCreated;
        totalRecurringExpensesProcessed += result.recurringExpensesProcessed;
    }

    public void finish(Database.BatchableContext context) {
        SpendlySettingsService.markRecurringRunCompleted(
            totalExpensesCreated,
            totalRecurringExpensesProcessed
        );
    }
}
