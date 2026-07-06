@isTest
private class FormResponseControllerTest {

    private static final String SCHEMA =
        '[{"key":"full_name","label":"שם מלא","type":"text","required":true,"mapTo":"respondentName"},'
        + '{"key":"email","label":"אימייל","type":"email","required":false,"mapTo":"email"},'
        + '{"key":"note","label":"הערה","type":"textarea","required":false}]';

    @isTest
    static void createsResponseAndFansOutAnswers() {
        FormBuilderController.saveForm(null, 'טופס בדיקה', 'תיאור', SCHEMA, 'test-vform', null);

        Test.startTest();
        FormResponseController.Result r = FormResponseController.submitResponse(
            'טופס בדיקה',
            'test-vform',
            '{"full_name":"ישראל ישראלי","email":"israel@example.com","note":"שלום"}',
            'ישראל ישראלי',
            'israel@example.com',
            '050-1234567',
            'בדיקה'
        );
        Test.stopTest();

        System.assertNotEquals(null, r.id, 'record created');
        System.assert(r.name != null && r.name.startsWith('FR-'), 'friendly auto-number returned');

        Form_Response__c saved = [
            SELECT Respondent_Name__c, Email__c, Status__c
            FROM Form_Response__c WHERE Id = :r.id
        ];
        System.assertEquals('ישראל ישראלי', saved.Respondent_Name__c);
        System.assertEquals('New', saved.Status__c);
        System.assertEquals(3, [SELECT COUNT() FROM Form_Answer__c WHERE Form_Response__c = :r.id],
            'trigger fanned the JSON out to 3 Form_Answer__c rows');
    }

    @isTest
    static void validationBlocksMissingRequiredAndBadFormat() {
        FormBuilderController.saveForm(null, 'טופס בדיקה', 'תיאור', SCHEMA, 'test-vform', null);

        // missing required full_name -> should throw
        Boolean threwRequired = false;
        try {
            FormResponseController.submitResponse(
                'טופס בדיקה', 'test-vform', '{"note":"רק הערה"}', null, null, null, 'בדיקה');
        } catch (Exception e) {
            threwRequired = true;
        }
        System.assertEquals(true, threwRequired, 'missing required field is rejected');

        // present but invalid email -> should throw
        Boolean threwEmail = false;
        try {
            FormResponseController.submitResponse(
                'טופס בדיקה', 'test-vform',
                '{"full_name":"פלוני","email":"not-an-email"}', 'פלוני', 'not-an-email', null, 'בדיקה');
        } catch (Exception e) {
            threwEmail = true;
        }
        System.assertEquals(true, threwEmail, 'invalid email is rejected');

        System.assertEquals(0, [SELECT COUNT() FROM Form_Response__c WHERE Form_External_Id__c = 'test-vform'],
            'no invalid submissions were persisted');
    }

    @isTest
    static void israeliIdCheckDigit() {
        System.assertEquals(true, FormValidationService.isValidIsraeliId('000000018'), 'valid id passes');
        System.assertEquals(false, FormValidationService.isValidIsraeliId('000000019'), 'bad check digit fails');
        System.assertEquals(false, FormValidationService.isValidIsraeliId('abc'), 'non-numeric fails');

        String idSchema = '[{"key":"tz","label":"ת\"ז","type":"idNumber","required":true}]';
        List<String> errs = FormValidationService.validate(idSchema, new Map<String, Object>{ 'tz' => '123456789' });
        System.assert(!errs.isEmpty(), 'invalid id produces a validation error');
    }

    @isTest
    static void previewAndUnknownFormSkipValidation() {
        // externalId 'preview' and unknown ids must not error (no template to validate against)
        FormResponseController.Result a = FormResponseController.submitResponse(
            'תצוגה', 'preview', '{"x":"1"}', null, null, null, null);
        FormResponseController.Result b = FormResponseController.submitResponse(
            'לא קיים', 'no-such-form', '{"x":"1"}', null, null, null, null);
        System.assertNotEquals(null, a.id);
        System.assertNotEquals(null, b.id);
    }
}
