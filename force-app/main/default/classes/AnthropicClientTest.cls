@isTest
private class AnthropicClientTest {

    private class OkMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse r = new HttpResponse();
            r.setStatusCode(200);
            r.setBody(JSON.serialize(new Map<String, Object>{
                'content' => new List<Object>{ new Map<String, Object>{ 'type' => 'text', 'text' => 'שלום' } }
            }));
            return r;
        }
    }

    @isTest
    static void orgConfigAndSend() {
        FormSettingsController.saveSettings('External', 'https://api.example.com/v1/messages', 'claude-opus-4-8', 'k');
        AnthropicClient.Config cfg = AnthropicClient.orgConfig();
        System.assertEquals(true, cfg.isExternal, 'external engine detected');

        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new OkMock());
        HttpResponse res = AnthropicClient.sendMessage(cfg.endpoint, cfg.model, cfg.apiKey, 'system', 'hi', 100);
        Test.stopTest();

        System.assertEquals(200, res.getStatusCode());
        System.assertEquals('שלום', AnthropicClient.extractText(res.getBody()), 'assistant text extracted');
    }

    @isTest
    static void multimodalPdfAndErrorMessages() {
        List<Object> content = new List<Object>{
            new Map<String, Object>{ 'type' => 'text', 'text' => 'check' },
            new Map<String, Object>{ 'type' => 'document', 'source' => new Map<String, Object>{
                'type' => 'base64', 'media_type' => 'application/pdf', 'data' => 'Zm9v' } }
        };
        Test.startTest();
        Test.setMock(HttpCalloutMock.class, new OkMock());
        HttpResponse res = AnthropicClient.sendMessage('https://api.example.com/v1/messages', null, 'k', null, content, 50);
        Test.stopTest();
        System.assertEquals(200, res.getStatusCode(), 'pdf content block sent (beta header path)');

        String credit = JSON.serialize(new Map<String, Object>{
            'error' => new Map<String, Object>{ 'message' => 'Your credit balance is too low' } });
        System.assert(AnthropicClient.describeApiError(credit).contains('קרדיט'), 'credit error humanized');
        String auth = JSON.serialize(new Map<String, Object>{
            'error' => new Map<String, Object>{ 'message' => 'authentication_error: invalid x-api-key' } });
        System.assert(AnthropicClient.describeApiError(auth).contains('מפתח'), 'auth error humanized');
        System.assert(String.isNotBlank(AnthropicClient.describeApiError('not-json')), 'non-JSON handled');
    }
}
