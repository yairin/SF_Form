@isTest
private class FormRoutingServiceTest {

    @isTest
    static void routesToDepartmentAndSetsSla() {
        Department__c d = new Department__c(Name = 'תרבות'); insert d;
        Service_Type__c st = new Service_Type__c(Name = 'אירועים', Department__c = d.Id, Default_SLA_Hours__c = 48);
        insert st;
        insert new Form_Template__c(Name = 'רישום', External_Id__c = 'evt-1',
            Schema_JSON__c = '[]', Service_Type__c = st.Id, Active__c = true);

        Test.startTest();
        Form_Response__c r = new Form_Response__c(
            Form_Name__c = 'רישום', Form_External_Id__c = 'evt-1', Response_Data__c = '{"a":"b"}');
        insert r;
        Test.stopTest();

        Form_Response__c saved = [
            SELECT Department__c, Service_Type__c, SLA_Due__c FROM Form_Response__c WHERE Id = :r.Id];
        System.assertEquals(d.Id, saved.Department__c, 'routed to department');
        System.assertEquals(st.Id, saved.Service_Type__c, 'service type set');
        System.assertNotEquals(null, saved.SLA_Due__c, 'SLA due set');
    }

    @isTest
    static void stampsAuthorityCodeFromTemplate() {
        insert new Form_Template__c(Name = 'עם רשות', External_Id__c = 'auth-1',
            Schema_JSON__c = '[]', Active__c = true, Authority_Code__c = '0000');

        Test.startTest();
        Form_Response__c r = new Form_Response__c(
            Form_External_Id__c = 'auth-1', Response_Data__c = '{"a":"b"}');
        insert r;
        Test.stopTest();

        Form_Response__c saved = [SELECT Authority_Code__c FROM Form_Response__c WHERE Id = :r.Id];
        System.assertEquals('0000', saved.Authority_Code__c,
            'response inherits the template authority code for isolation');
    }

    @isTest
    static void noServiceTypeLeavesRoutingEmpty() {
        insert new Form_Template__c(Name = 'x', External_Id__c = 'x-1', Schema_JSON__c = '[]', Active__c = true);
        Test.startTest();
        Form_Response__c r = new Form_Response__c(Form_External_Id__c = 'x-1', Response_Data__c = '{}');
        insert r;
        Test.stopTest();
        System.assertEquals(null, [SELECT Department__c FROM Form_Response__c WHERE Id = :r.Id].Department__c);
    }
}
