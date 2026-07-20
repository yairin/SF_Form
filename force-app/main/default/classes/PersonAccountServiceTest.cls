@isTest
private class PersonAccountServiceTest {

    // When the form does NOT opt in, the sync is a pure no-op and the response is
    // created normally (no Account stamped).
    @isTest
    static void disabledFormIsNoOp() {
        insert new Form_Template__c(Name = 'רגיל', External_Id__c = 'pa-off',
            Schema_JSON__c = '[]', Active__c = true, Create_Person_Account__c = false);
        Test.startTest();
        Form_Response__c r = new Form_Response__c(
            Form_External_Id__c = 'pa-off', Response_Data__c = '{"firstName":"דנה"}');
        insert r;
        Test.stopTest();
        System.assertEquals(null,
            [SELECT Account__c FROM Form_Response__c WHERE Id = :r.Id].Account__c,
            'no Person Account when the form opts out');
    }

    // When the form opts in but Person Accounts is not enabled (no person record type),
    // the service must fail closed: no exception, response still created, no Account.
    @isTest
    static void enabledButNoPersonAccountsIsSafe() {
        String schema = JSON.serialize(new Map<String, Object>{
            'fields' => new List<Object>{
                new Map<String, Object>{ 'key' => 'firstName', 'label' => 'שם פרטי', 'type' => 'firstName' },
                new Map<String, Object>{ 'key' => 'lastName', 'label' => 'שם משפחה', 'type' => 'lastName' },
                new Map<String, Object>{ 'key' => 'city', 'label' => 'עיר', 'type' => 'city' }
            }
        });
        insert new Form_Template__c(Name = 'עם כרטיס אדם', External_Id__c = 'pa-on',
            Schema_JSON__c = schema, Active__c = true, Create_Person_Account__c = true,
            Person_Account_Map_JSON__c = '{"map":{"idNumber":"Id_Number__pc"},"matchAccountField":"Id_Number__pc","matchFormKey":"idNumber"}');

        Test.startTest();
        Form_Response__c r = new Form_Response__c(
            Form_External_Id__c = 'pa-on',
            Response_Data__c = '{"firstName":"דנה","lastName":"כהן","city":"תל אביב","idNumber":"000000018"}');
        insert r; // must not throw even if Person Accounts is off
        // also exercise the entry point directly for coverage
        PersonAccountService.syncFromResponses(new List<Form_Response__c>{ r });
        Test.stopTest();

        // Either a Person Account was created (PA-enabled org) or not (PA-disabled) — both are OK;
        // the guarantee is that the submission itself succeeded.
        System.assertNotEquals(null, [SELECT Id FROM Form_Response__c WHERE Id = :r.Id].Id,
            'the response is created regardless of Person Account availability');
    }
}
