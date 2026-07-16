@isTest
private class CaseHandoffServiceTest {

    @isTest
    static void createsCaseAndLinksBothWays() {
        FormBuilderController.saveForm(null, 'בקשת תושב', '', '[{"key":"a","label":"שדה","type":"text"}]', 'handoff-x', null);
        FormResponseController.Result r = FormResponseController.submitResponse(
            'בקשת תושב', 'handoff-x', '{"a":"ערך","note":"בדיקה"}', 'ישראל ישראלי', 'a@b.com', '050-0000000', 'נושא הפנייה');

        Test.startTest();
        CaseHandoffService.HandoffResult h1 = CaseHandoffService.createCaseFromResponse(r.id);
        // second call must be idempotent — returns the same case, does not create another
        CaseHandoffService.HandoffResult h2 = CaseHandoffService.createCaseFromResponse(r.id);
        Test.stopTest();

        System.assertNotEquals(null, h1.caseId, 'case created');
        System.assertEquals(true, h1.created, 'first call creates');
        System.assertEquals(false, h2.created, 'second call is idempotent');
        System.assertEquals(h1.caseId, h2.caseId, 'same case returned');

        Case c = [SELECT Id, Subject, SuppliedName, SuppliedEmail, Form_Response__c FROM Case WHERE Id = :h1.caseId];
        System.assertEquals('נושא הפנייה', c.Subject, 'subject mapped');
        System.assertEquals('ישראל ישראלי', c.SuppliedName, 'name mapped');
        System.assertEquals(r.id, c.Form_Response__c, 'case links back to the response');

        Form_Response__c fr = [SELECT Case__c FROM Form_Response__c WHERE Id = :r.id];
        System.assertEquals(h1.caseId, fr.Case__c, 'response links to the case');

        System.assertEquals(1, [SELECT COUNT() FROM Case WHERE Form_Response__c = :r.id], 'exactly one case');
    }
}
