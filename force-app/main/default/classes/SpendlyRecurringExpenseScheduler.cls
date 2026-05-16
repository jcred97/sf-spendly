public with sharing class SpendlyRecurringExpenseScheduler implements Schedulable {
    public void execute(SchedulableContext context) {
        Database.executeBatch(
            new SpendlyRecurringExpenseBatch(),
            SpendlyRecurringExpenseBatch.DEFAULT_BATCH_SIZE
        );
    }
}
