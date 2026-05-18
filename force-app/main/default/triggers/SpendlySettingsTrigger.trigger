trigger SpendlySettingsTrigger on Spendly_Settings__c (before insert) {
    if (Trigger.new.size() > 1 || [SELECT COUNT() FROM Spendly_Settings__c] > 0) {
        for (Spendly_Settings__c settings : Trigger.new) {
            settings.addError('Only one Spendly Settings record can exist.');
        }
    }
}
