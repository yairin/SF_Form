@isTest
private class FormFileValidationServiceTest {

    private class VerdictMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            String verdict = JSON.serialize(new Map<String, Object>{
                'isCorrectType' => true, 'detailsMatch' => true, 'notes' => 'תואם'
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

    private class MismatchMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            String verdict = JSON.serialize(new Map<String, Object>{
                'isCorrectType' => true, 'detailsMatch' => false, 'notes' => 'שם שונה'
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
    static void typeMismatchRejectedWithoutCallout() {
        FormFileValidationService.FileVerdict v = FormFileValidationService.validateFile(
            'תעודת זהות', new List<String>{ 'pdf', 'png', 'jpg' }, 'notes.txt', null, '{}', null);
        System.assertEquals(false, v.typeOk, 'txt is not an accepted type');
    }

    @isTest
    static void aiVerifiesImageMatchesApplicant() {
        FormSettingsController.saveSettings('External', 'https://api.example.com/v1/messages', 'claude-opus-4-8', 'k');
        String b64 = EncodingUtil.base64Encode(Blob.valueOf('image-bytes'));
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new VerdictMock());
        FormFileValidationService.FileVerdict v = FormFileValidationService.validateFile(
            'תעודת זהות', new List<String>{ 'png' }, 'id.png', b64,
            '{"firstName":"יוסי","lastName":"כהן","idNumber":"123456782"}',
            new List<String>{ 'firstName', 'idNumber' });
        Test.stopTest();
        System.assertEquals(true, v.typeOk);
        System.assertEquals(true, v.aiChecked, 'AI content check ran');
        System.assertEquals(true, v.aiOk, 'correct type + details match');
    }

    @isTest
    static void aiFlagsDetailMismatch() {
        FormSettingsController.saveSettings('External', 'https://api.example.com/v1/messages', 'm', 'k');
        String b64 = EncodingUtil.base64Encode(Blob.valueOf('image-bytes'));
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new MismatchMock());
        FormFileValidationService.FileVerdict v = FormFileValidationService.validateFile(
            'תעודת זהות', null, 'id.png', b64, '{"firstName":"דנה"}', null);
        Test.stopTest();
        System.assertEquals(true, v.aiChecked);
        System.assertEquals(false, v.aiOk, 'details mismatch flagged');
    }

    @isTest
    static void noEngineAcceptsTypeSkipsAi() {
        String b64 = EncodingUtil.base64Encode(Blob.valueOf('image-bytes'));
        FormFileValidationService.FileVerdict v = FormFileValidationService.validateFile(
            'תעודת זהות', new List<String>{ 'png' }, 'id.png', b64, '{}', null);
        System.assertEquals(true, v.typeOk);
        System.assertEquals(false, v.aiChecked, 'AI skipped when no external engine configured');
    }
}
