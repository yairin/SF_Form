@isTest
private class FormResponseControllerTest {

    @isTest
    static void createsResponseAndFansOutAnswers() {
        Test.startTest();
        FormResponseController.Result r = FormResponseController.submitResponse(
            'טופס רישום לאירוע',
            'event-registration',
            '{"track":"מסלול בוקר","needs_transport":true,"pickup":"הרצל 1"}',
            'ישראל ישראלי',
            'israel@example.com',
            '050-1234567',
            'רישום לאירוע'
        );
        Test.stopTest();

        System.assertNotEquals(null, r.id, 'record created');
        System.assert(r.name != null && r.name.startsWith('FR-'), 'friendly auto-number returned');

        Form_Response__c saved = [
            SELECT Respondent_Name__c, Email__c, Phone__c, Status__c
            FROM Form_Response__c WHERE Id = :r.id
        ];
        System.assertEquals('ישראל ישראלי', saved.Respondent_Name__c);
        System.assertEquals('israel@example.com', saved.Email__c);
        System.assertEquals('New', saved.Status__c);

        System.assertEquals(3, [SELECT COUNT() FROM Form_Answer__c WHERE Form_Response__c = :r.id],
            'trigger fanned the JSON out to 3 Form_Answer__c rows');
    }
}
