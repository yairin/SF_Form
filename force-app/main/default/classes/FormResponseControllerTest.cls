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

        String idSchema = '[{"key":"tz","label":"תעודת זהות","type":"idNumber","required":true}]';
        List<String> errs = FormValidationService.validate(idSchema, new Map<String, Object>{ 'tz' => '123456789' });
        System.assert(!errs.isEmpty(), 'invalid id produces a validation error');
        List<String> ok = FormValidationService.validate(idSchema, new Map<String, Object>{ 'tz' => '000000018' });
        System.assert(ok.isEmpty(), 'valid id passes schema validation');
    }

    @isTest
    static void steppedSchemaValidationFlattens() {
        String stepped = '{"steps":['
            + '{"title":"פרטים אישיים","fields":[{"key":"a","label":"שם","type":"text","required":true}]},'
            + '{"title":"פרטי קשר","fields":[{"key":"b","label":"אימייל","type":"email","required":true}]}]}';
        System.assertEquals(2, FormValidationService.flattenFields(stepped).size(),
            'fields flattened across steps');
        System.assert(!FormValidationService.validate(stepped, new Map<String, Object>{ 'a' => 'x' }).isEmpty(),
            'missing required field in step 2 is caught');
        System.assert(FormValidationService.validate(
                stepped, new Map<String, Object>{ 'a' => 'x', 'b' => 'y@z.com' }).isEmpty(),
            'complete stepped payload passes');
    }

    @isTest
    static void attachesFilesToResponse() {
        FormResponseController.Result r = FormResponseController.submitResponse(
            'טופס', 'preview', '{}', null, null, null, null);
        FormFileService.FileInput fi = new FormFileService.FileInput();
        fi.name = 'doc.txt';
        fi.base64 = EncodingUtil.base64Encode(Blob.valueOf('hello world'));

        Test.startTest();
        FormFileService.attachFiles(r.id, new List<FormFileService.FileInput>{ fi });
        Test.stopTest();

        System.assertEquals(1,
            [SELECT COUNT() FROM ContentDocumentLink WHERE LinkedEntityId = :r.id],
            'file linked to the response');
    }

    private class LlmMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            String verdict = JSON.serialize(new Map<String, Object>{
                'complete' => true, 'missing' => new List<Object>(), 'notes' => 'ההגשה תקינה'
            });
            String body = JSON.serialize(new Map<String, Object>{
                'content' => new List<Object>{ new Map<String, Object>{ 'type' => 'text', 'text' => verdict } }
            });
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);
            res.setBody(body);
            return res;
        }
    }

    @isTest
    static void aiReviewExternalEngineApproves() {
        FormSettingsController.saveSettings('External', 'https://api.example.com/v1/messages', 'claude-opus-4-8', 'k');
        FormBuilderController.saveForm(null, 'טופס AI', 'תיאור', SCHEMA, 'ai-review-x', null);
        Form_Template__c t = [SELECT Id FROM Form_Template__c WHERE External_Id__c = 'ai-review-x' LIMIT 1];
        FormBuilderController.setAIConfig(t.Id, true, 'ודא שצורף מסמך רלוונטי.', true, true);
        FormResponseController.Result r = FormResponseController.submitResponse(
            'טופס AI', 'ai-review-x', '{"full_name":"פלוני","email":"a@b.com"}', 'פלוני', 'a@b.com', null, 'x');

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new LlmMock());
        FormAIReviewService.ReviewResult rr = FormAIReviewService.runReview(r.id);
        Test.stopTest();

        System.assertEquals('Approved', rr.status, 'complete verdict maps to Approved');
        System.assertEquals('Approved',
            [SELECT AI_Status__c FROM Form_Response__c WHERE Id = :r.id].AI_Status__c, 'status written to record');
    }

    private class LlmCreditErrorMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            String body = JSON.serialize(new Map<String, Object>{
                'type' => 'error',
                'error' => new Map<String, Object>{
                    'type' => 'invalid_request_error',
                    'message' => 'Your credit balance is too low to access the Anthropic API.'
                }
            });
            HttpResponse res = new HttpResponse();
            res.setStatusCode(400);
            res.setBody(body);
            return res;
        }
    }

    @isTest
    static void aiReviewExternalApiErrorIsHumanReadable() {
        FormSettingsController.saveSettings('External', 'https://api.example.com/v1/messages', 'm', 'k');
        FormResponseController.Result r = FormResponseController.submitResponse(
            'טופס', 'preview', '{"x":"1"}', 'פלוני', 'a@b.com', null, 'x');

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new LlmCreditErrorMock());
        FormAIReviewService.ReviewResult rr = FormAIReviewService.runReview(r.id);
        Test.stopTest();

        System.assertEquals('Error', rr.status, 'non-200 maps to Error');
        System.assert(rr.findings.contains('קרדיט'),
            'credit-balance error surfaces a readable Hebrew cause, not raw JSON');
    }

    private class LlmMissingMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            String verdict = JSON.serialize(new Map<String, Object>{
                'complete' => false,
                'missing' => new List<Object>{ 'צילום תעודת זהות', 'אישור תושב' },
                'notes' => 'חסרים מסמכים'
            });
            String body = JSON.serialize(new Map<String, Object>{
                'content' => new List<Object>{ new Map<String, Object>{ 'type' => 'text', 'text' => verdict } }
            });
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);
            res.setBody(body);
            return res;
        }
    }

    @isTest
    static void aiReviewExternalNeedsInfoWithAttachment() {
        FormSettingsController.saveSettings('External', 'https://api.example.com/v1/messages', 'm', 'k');
        FormResponseController.Result r = FormResponseController.submitResponse(
            'טופס', 'preview', '{"x":"1"}', 'פלוני', 'a@b.com', null, 'x');
        FormFileService.FileInput fi = new FormFileService.FileInput();
        fi.name = 'note.txt';
        fi.base64 = EncodingUtil.base64Encode(Blob.valueOf('תוכן המסמך לבדיקה'));
        FormFileService.attachFiles(r.id, new List<FormFileService.FileInput>{ fi });

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new LlmMissingMock());
        FormAIReviewService.ReviewResult rr = FormAIReviewService.runReview(r.id);
        Test.stopTest();

        System.assertEquals('Needs_Info', rr.status, 'incomplete verdict maps to Needs_Info');
        System.assert(rr.findings.contains('צילום תעודת זהות'), 'missing items listed in findings');
    }

    @isTest
    static void aiReviewExternalNoEndpointErrors() {
        FormSettingsController.saveSettings('External', null, null, 'k'); // endpoint blank
        FormResponseController.Result r = FormResponseController.submitResponse(
            'טופס', 'preview', '{}', null, null, null, null);
        Test.startTest();
        FormAIReviewService.ReviewResult rr = FormAIReviewService.runReview(r.id);
        Test.stopTest();
        System.assertEquals('Error', rr.status, 'missing endpoint -> Error');
    }

    @isTest
    static void authorityStampedAndPerAuthorityEngineUsed() {
        Authority__c auth = new Authority__c(
            Name = 'רשות א', Code__c = 'A',
            AI_Engine__c = 'External', LLM_Endpoint__c = 'https://api.example.com/v1/messages',
            LLM_Model__c = 'claude-opus-4-8', LLM_API_Key__c = 'auth-key'
        );
        insert auth;
        FormBuilderController.saveForm(null, 'טופס רשות', 'תיאור', SCHEMA, 'auth-form', null);
        Form_Template__c t = [SELECT Id FROM Form_Template__c WHERE External_Id__c = 'auth-form' LIMIT 1];
        t.Authority__c = auth.Id;
        update t;

        FormResponseController.Result r = FormResponseController.submitResponse(
            'טופס רשות', 'auth-form', '{"full_name":"פלוני","email":"a@b.com"}', 'פלוני', 'a@b.com', null, 'x');

        // the after-insert routing stamps the tenant onto the response
        System.assertEquals(auth.Id,
            [SELECT Authority__c FROM Form_Response__c WHERE Id = :r.id].Authority__c,
            'response stamped with its template authority');

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new LlmMock());
        FormAIReviewService.ReviewResult rr = FormAIReviewService.runReview(r.id);
        Test.stopTest();

        System.assertEquals('Approved', rr.status, 'per-authority external engine was used');
    }

    @isTest
    static void requestCompletionSetsTokenAndFlag() {
        FormResponseController.Result r = FormResponseController.submitResponse(
            'טופס', 'preview', '{}', 'פלוני', 'applicant@example.com', null, 'x');
        // seed a needs-info finding
        update new Form_Response__c(Id = r.id, AI_Status__c = 'Needs_Info', AI_Findings__c = 'חסר מסמך');

        Test.startTest();
        FormAIReviewService.requestCompletion(r.id);
        Test.stopTest();

        Form_Response__c saved = [
            SELECT Update_Requested__c, Update_Token__c FROM Form_Response__c WHERE Id = :r.id
        ];
        System.assertEquals(true, saved.Update_Requested__c, 'update requested flag set');
        System.assert(String.isNotBlank(saved.Update_Token__c), 'completion token generated');

        FormAIReviewService.ReviewInfo info = FormAIReviewService.getReview(r.id);
        System.assertEquals('Needs_Info', info.status, 'getReview returns current status');
        System.assertEquals(true, info.updateRequested, 'getReview reflects requested flag');
    }

    @isTest
    static void requestCompletionWithoutEmailThrows() {
        FormResponseController.Result r = FormResponseController.submitResponse(
            'טופס', 'preview', '{}', null, null, null, null);
        Boolean threw = false;
        try {
            FormAIReviewService.requestCompletion(r.id);
        } catch (Exception e) {
            threw = true;
        }
        System.assertEquals(true, threw, 'no applicant email -> error');
    }

    @isTest
    static void aiReviewAgentforceStubReportsUnconfigured() {
        FormSettingsController.saveSettings('Agentforce', null, null, null);
        FormResponseController.Result r = FormResponseController.submitResponse(
            'טופס', 'preview', '{}', null, null, null, null);
        Test.startTest();
        FormAIReviewService.ReviewResult rr = FormAIReviewService.runReview(r.id);
        Test.stopTest();
        System.assertEquals('Error', rr.status, 'agentforce not wired yet -> Error status');
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
