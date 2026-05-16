public with sharing class SpendlyRecurringExpenseScheduler implements Schedulable {
    public void execute(SchedulableContext context) {
        SpendlyRecurringExpenseService.generateDueExpenses();
    }
}
