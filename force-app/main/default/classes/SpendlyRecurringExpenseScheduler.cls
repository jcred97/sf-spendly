public with sharing class SpendlyRecurringExpenseScheduler implements Schedulable {
    public void execute(SchedulableContext context) {
        if (!SpendlySettingsService.areRecurringExpensesEnabled()) {
            SpendlySettingsService.markRecurringRunSkipped('Recurring expenses are disabled in Spendly Settings.');
            return;
        }

        Database.executeBatch(
            new SpendlyRecurringExpenseBatch(),
            SpendlyRecurringExpenseBatch.DEFAULT_BATCH_SIZE
        );
    }
}
