public with sharing class SpendlyRecurringExpenseCalculator {
    public static Boolean shouldGenerateForDate(
        Recurring_Expense__c recurringExpense,
        Date dueDate,
        Date runDate
    ) {
        return dueDate != null
            && dueDate <= runDate
            && (recurringExpense.End_Date__c == null || dueDate <= recurringExpense.End_Date__c);
    }

    public static Date getNextRunDate(Date dueDate, String frequency, Date anchorDate) {
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
