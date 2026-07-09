/**
 * Single source of truth for Anthropic (Claude) HTTP calls: headers, API version,
 * model default, multimodal (image/PDF) support, and response parsing. Used by
 * FormAIReviewService (review + narrate) and FormFileValidationService.
 */
public without sharing class AnthropicClient {

    public static final String API_VERSION = '2023-06-01';
    public static final String DEFAULT_MODEL = 'claude-opus-4-8';

    public class Config {
        public String endpoint;
        public String model;
        public String apiKey;
        public Boolean isExternal = false;
    }

    /** Org-default external-engine configuration (Form_AI_Setting__c). */
    public static Config orgConfig() {
        Config c = new Config();
        Form_AI_Setting__c s = Form_AI_Setting__c.getOrgDefaults();
        if (s != null) {
            c.endpoint = s.LLM_Endpoint__c;
            c.model = s.LLM_Model__c;
            c.apiKey = s.LLM_API_Key__c;
            c.isExternal = (s.Engine__c == 'External' && String.isNotBlank(s.LLM_Endpoint__c));
        }
        return c;
    }

    /**
     * Sends a single user message. `content` may be a String (plain text) or a
     * List<Object> of Anthropic content blocks (text/image/document). The PDF beta
     * header is added automatically when a document block is present.
     */
    public static HttpResponse sendMessage(String endpoint, String model, String apiKey,
            String systemPrompt, Object content, Integer maxTokens) {
        Boolean hasPdf = false;
        if (content instanceof List<Object>) {
            for (Object b : (List<Object>) content) {
                if (b instanceof Map<String, Object>
                    && 'document'.equals(((Map<String, Object>) b).get('type'))) {
                    hasPdf = true;
                }
            }
        }
        HttpRequest req = new HttpRequest();
        req.setEndpoint(endpoint);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('x-api-key', apiKey == null ? '' : apiKey);
        req.setHeader('anthropic-version', API_VERSION);
        if (hasPdf) req.setHeader('anthropic-beta', 'pdfs-2024-09-25');
        req.setTimeout(120000);
        Map<String, Object> body = new Map<String, Object>{
            'model' => String.isBlank(model) ? DEFAULT_MODEL : model,
            'max_tokens' => maxTokens,
            'messages' => new List<Object>{ new Map<String, Object>{ 'role' => 'user', 'content' => content } }
        };
        if (String.isNotBlank(systemPrompt)) body.put('system', systemPrompt);
        req.setBody(JSON.serialize(body));
        return new Http().send(req);
    }

    /** Pull the assistant text out of an Anthropic-style response, else return the raw body. */
    public static String extractText(String responseBody) {
        try {
            Object parsed = JSON.deserializeUntyped(responseBody);
            if (parsed instanceof Map<String, Object>) {
                Object content = ((Map<String, Object>) parsed).get('content');
                if (content instanceof List<Object> && !((List<Object>) content).isEmpty()) {
                    Object first = ((List<Object>) content)[0];
                    if (first instanceof Map<String, Object>) {
                        Object txt = ((Map<String, Object>) first).get('text');
                        if (txt != null) return String.valueOf(txt);
                    }
                }
            }
        } catch (Exception e) { /* fall through */ }
        return responseBody;
    }

    /** Turn an Anthropic error body into a short, human-readable Hebrew explanation. */
    public static String describeApiError(String responseBody) {
        String apiMsg = null;
        try {
            Object parsed = JSON.deserializeUntyped(responseBody);
            if (parsed instanceof Map<String, Object>) {
                Object err = ((Map<String, Object>) parsed).get('error');
                if (err instanceof Map<String, Object>) {
                    Object m = ((Map<String, Object>) err).get('message');
                    if (m != null) apiMsg = String.valueOf(m);
                }
            }
        } catch (Exception e) { /* non-JSON body */ }
        if (apiMsg == null) return 'ודא מפתח ויתרת קרדיט תקינים בהגדרות.';
        String lower = apiMsg.toLowerCase();
        if (lower.contains('credit balance')) {
            return 'יתרת הקרדיט בחשבון ה-AI נמוכה מדי. יש לטעון קרדיט ב-Anthropic (Plans & Billing) ולנסות שוב.';
        }
        if (lower.contains('authentication') || lower.contains('api key') || lower.contains('x-api-key')) {
            return 'המפתח שהוזן אינו תקין. הזן מפתח API תקין בהגדרות ("מנוע חיצוני").';
        }
        return apiMsg;
    }
}
