// Idempotent reference data so routing has departments/service types and the
// builder's Service Type picker has options.
if ([SELECT COUNT() FROM Department__c] == 0) {
    Department__c culture = new Department__c(Name = 'תרבות', Email__c = 'culture@example.gov.il');
    Department__c licensing = new Department__c(Name = 'רישוי', Email__c = 'licensing@example.gov.il');
    insert new List<Department__c>{ culture, licensing };
    insert new List<Service_Type__c>{
        new Service_Type__c(Name = 'רישום לאירוע', Department__c = culture.Id, Default_SLA_Hours__c = 48),
        new Service_Type__c(Name = 'בקשה כללית', Department__c = licensing.Id, Default_SLA_Hours__c = 72)
    };
    System.debug('SEED created departments + service types');
} else {
    System.debug('SEED skipped departments (data already exists)');
}

// The old 'event-registration' sample template was retired in favour of the richer
// 'masham-demo' showcase (seeded by scripts/seed-demo-form.apex). Remove it if present.
// Idempotent; responses are referenced by external-id text (no cascade), so they remain.
List<Form_Template__c> legacy = [SELECT Id FROM Form_Template__c WHERE External_Id__c = 'event-registration'];
if (!legacy.isEmpty()) {
    delete legacy;
    System.debug('SEED removed legacy public template event-registration (' + legacy.size() + ')');
} else {
    System.debug('SEED legacy public template already absent');
}
