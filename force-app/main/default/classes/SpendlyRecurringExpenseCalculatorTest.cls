@IsTest
private class SpendlyRecurringExpenseCalculatorTest {
    @IsTest
    static void testGetNextRunDateUsesSimpleIntervals() {
        Date dueDate = Date.newInstance(2026, 5, 17);

        System.assertEquals(
            Date.newInstance(2026, 5, 18),
            SpendlyRecurringExpenseCalculator.getNextRunDate(dueDate, 'Daily', dueDate)
        );
        System.assertEquals(
            Date.newInstance(2026, 5, 24),
            SpendlyRecurringExpenseCalculator.getNextRunDate(dueDate, 'Weekly', dueDate)
        );
    }

    @IsTest
    static void testGetNextRunDateKeepsMonthlyAnchor() {
        Date anchorDate = Date.newInstance(2026, 1, 30);

        System.assertEquals(
            Date.newInstance(2026, 2, 28),
            SpendlyRecurringExpenseCalculator.getNextRunDate(anchorDate, 'Monthly', anchorDate)
        );
        System.assertEquals(
            Date.newInstance(2026, 3, 30),
            SpendlyRecurringExpenseCalculator.getNextRunDate(
                Date.newInstance(2026, 2, 28),
                'Monthly',
                anchorDate
            )
        );
    }

    @IsTest
    static void testGetNextRunDateKeepsYearlyAnchor() {
        Date anchorDate = Date.newInstance(2024, 2, 29);

        System.assertEquals(
            Date.newInstance(2025, 2, 28),
            SpendlyRecurringExpenseCalculator.getNextRunDate(anchorDate, 'Yearly', anchorDate)
        );
        System.assertEquals(
            Date.newInstance(2028, 2, 29),
            SpendlyRecurringExpenseCalculator.getNextRunDate(
                Date.newInstance(2027, 2, 28),
                'Yearly',
                anchorDate
            )
        );
    }

    @IsTest
    static void testShouldGenerateForDateRespectsRunDateAndEndDate() {
        Recurring_Expense__c recurringExpense = new Recurring_Expense__c(
            End_Date__c = Date.newInstance(2026, 5, 31)
        );

        System.assertEquals(
            true,
            SpendlyRecurringExpenseCalculator.shouldGenerateForDate(
                recurringExpense,
                Date.newInstance(2026, 5, 17),
                Date.newInstance(2026, 5, 17)
            )
        );
        System.assertEquals(
            false,
            SpendlyRecurringExpenseCalculator.shouldGenerateForDate(
                recurringExpense,
                Date.newInstance(2026, 6, 1),
                Date.newInstance(2026, 6, 1)
            )
        );
        System.assertEquals(
            false,
            SpendlyRecurringExpenseCalculator.shouldGenerateForDate(
                recurringExpense,
                Date.newInstance(2026, 5, 18),
                Date.newInstance(2026, 5, 17)
            )
        );
    }

    @IsTest
    static void testGetNextRunDateRejectsUnsupportedFrequency() {
        Boolean exceptionThrown = false;

        try {
            SpendlyRecurringExpenseCalculator.getNextRunDate(
                Date.newInstance(2026, 5, 17),
                'Quarterly',
                Date.newInstance(2026, 5, 17)
            );
        } catch (AuraHandledException e) {
            exceptionThrown = true;
        }

        System.assertEquals(true, exceptionThrown, 'Unsupported frequencies should throw a handled exception');
    }
}
