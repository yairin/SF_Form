@isTest
private class FormResponseAnswerServiceTest {

    @isTest
    static void flattensJsonIntoAnswers() {
        String json =
            '{"full_name":"ישראל ישראלי","email":"a@b.com","track":"מסלול בוקר",'
            + '"needs_transport":true,"party_size":3,"event_date":"2026-08-01",'
            + '"topics":["הסעות","קייטרינג"]}';

        Test.startTest();
        insert new Form_Response__c(
            Form_Name__c = 'Event Registration',
            Response_Data__c = json
        );
        Test.stopTest();

        Map<String, Form_Answer__c> byKey = new Map<String, Form_Answer__c>();
        for (Form_Answer__c a : [
            SELECT Field_Key__c, Value_Text__c, Value_Number__c, Value_Date__c
            FROM Form_Answer__c
        ]) {
            byKey.put(a.Field_Key__c, a);
        }

        System.assertEquals(7, byKey.size(), 'One answer row per JSON key');
        System.assertEquals('ישראל ישראלי', byKey.get('full_name').Value_Text__c);
        System.assertEquals('true', byKey.get('needs_transport').Value_Text__c);
        System.assertEquals(3, byKey.get('party_size').Value_Number__c);
        System.assertEquals(Date.newInstance(2026, 8, 1), byKey.get('event_date').Value_Date__c);
        System.assertEquals('הסעות; קייטרינג', byKey.get('topics').Value_Text__c,
            'Multi-select values are joined');
    }

    @isTest
    static void ignoresBlankAndInvalidJson() {
        Test.startTest();
        insert new List<Form_Response__c>{
            new Form_Response__c(Form_Name__c = 'Blank'),
            new Form_Response__c(Form_Name__c = 'Bad', Response_Data__c = 'not-json'),
            new Form_Response__c(Form_Name__c = 'Array', Response_Data__c = '[1,2,3]')
        };
        Test.stopTest();

        System.assertEquals(0, [SELECT COUNT() FROM Form_Answer__c],
            'No answers created for blank / invalid / non-object JSON');
    }

    @isTest
    static void truncatesLongValues() {
        String longVal = 'x'.repeat(400);
        Test.startTest();
        insert new Form_Response__c(
            Form_Name__c = 'Long',
            Response_Data__c = '{"notes":"' + longVal + '"}'
        );
        Test.stopTest();

        Form_Answer__c a = [SELECT Value_Text__c FROM Form_Answer__c LIMIT 1];
        System.assertEquals(255, a.Value_Text__c.length(), 'Value truncated to 255');
    }
}
