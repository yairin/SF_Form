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
    System.debug('SEED skipped (data already exists)');
}
