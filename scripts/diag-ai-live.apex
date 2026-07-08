// בדיקה חיה: מבצע callout אמיתי ל-endpoint עם המפתח השמור ומדפיס קוד HTTP + גוף התשובה.
// לא חושף את המפתח (רק אורך + prefix). מאמת שיש יתרה ושהמפתח פעיל.
Form_AI_Setting__c s = Form_AI_Setting__c.getOrgDefaults();
if (s == null) { System.debug('SETTINGS|null'); return; }
String key = s.LLM_API_Key__c;
Integer keyLen = key == null ? 0 : key.length();
String keyPrefix = (key == null || key.length() < 12) ? String.valueOf(key) : key.substring(0, 12);
System.debug('SETTINGS|engine=[' + s.Engine__c + ']|endpoint=[' + s.LLM_Endpoint__c
    + ']|model=[' + s.LLM_Model__c + ']|keyLen=' + keyLen + '|keyPrefix=[' + keyPrefix + '...]');

try {
    HttpRequest req = new HttpRequest();
    req.setEndpoint(s.LLM_Endpoint__c);
    req.setMethod('POST');
    req.setHeader('Content-Type', 'application/json');
    req.setHeader('x-api-key', key == null ? '' : key);
    req.setHeader('anthropic-version', '2023-06-01');
    req.setTimeout(60000);
    Map<String,Object> body = new Map<String,Object>{
        'model' => String.isBlank(s.LLM_Model__c) ? 'claude-opus-4-8' : s.LLM_Model__c,
        'max_tokens' => 32,
        'messages' => new List<Object>{ new Map<String,Object>{ 'role' => 'user',
            'content' => 'ענה במילה אחת: תקין' } }
    };
    req.setBody(JSON.serialize(body));
    HttpResponse res = new Http().send(req);
    String snippet = res.getBody();
    if (snippet != null && snippet.length() > 500) snippet = snippet.substring(0, 500);
    System.debug('CALLOUT|status=' + res.getStatusCode() + '|body=' + snippet);
    if (res.getStatusCode() == 200) {
        System.debug('VERDICT|✓ יש יתרה והמפתח פעיל — המנוע מוכן לשימוש.');
    } else {
        System.debug('VERDICT|✗ עדיין נדחה (קוד ' + res.getStatusCode() + '). ראה body.');
    }
} catch (Exception e) {
    System.debug('CALLOUT_ERROR|' + e.getMessage());
}
