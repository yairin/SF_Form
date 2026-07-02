// CI smoke test: create a demo Form Response and verify the trigger created
// its Form_Answer__c rows. Left in the org so it is visible in the UI.
Form_Response__c r = new Form_Response__c(
    Form_Name__c        = 'טופס רישום לאירוע (דמו CI)',
    Form_External_Id__c = 'event-demo',
    Submitted_At__c     = System.now(),
    Respondent_Name__c  = 'ישראל ישראלי',
    Email__c            = 'israel@example.com',
    Phone__c            = '050-1234567',
    Subject__c          = 'רישום לאירוע',
    Response_Data__c    = '{"track":"מסלול בוקר","party_size":3,"needs_transport":true}'
);
insert r;

Integer cnt = [SELECT COUNT() FROM Form_Answer__c WHERE Form_Response__c = :r.Id];
System.debug('SMOKE responseId=' + r.Id + ' answers=' + cnt);
if (cnt != 3) {
    throw new System.AssertException('Expected 3 Form_Answer__c rows, got ' + cnt);
}
System.debug('SMOKE OK');
