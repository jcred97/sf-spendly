trigger RecurringExpenseTrigger on Recurring_Expense__c (before insert, before update) {
    for (Recurring_Expense__c recurringExpense : Trigger.new) {
        if (Trigger.isInsert) {
            if (recurringExpense.Next_Run_Date__c == null) {
                recurringExpense.Next_Run_Date__c = recurringExpense.Start_Date__c;
            }
            continue;
        }

        Recurring_Expense__c oldRecurringExpense = Trigger.oldMap.get(recurringExpense.Id);
        Boolean startDateChanged = recurringExpense.Start_Date__c != oldRecurringExpense.Start_Date__c;
        Boolean nextRunChanged = recurringExpense.Next_Run_Date__c != oldRecurringExpense.Next_Run_Date__c;
        Boolean nextRunStillTracksStart =
            oldRecurringExpense.Next_Run_Date__c == null
            || oldRecurringExpense.Next_Run_Date__c == oldRecurringExpense.Start_Date__c;

        if (startDateChanged && !nextRunChanged && nextRunStillTracksStart) {
            recurringExpense.Next_Run_Date__c = recurringExpense.Start_Date__c;
        }
    }
}
