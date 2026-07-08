// אבחון חי: קורא את הגדרות ברירת המחדל הארגונית + מבצע callout בדיקה ל-endpoint.
// לא חושף את המפתח (רק אורך + prefix ממוסך + קוד HTTP + תחילת גוף התשובה).
Form_AI_Setting__c s = Form_AI_Setting__c.getOrgDefaults();
if (s == null) { System.debug('SETTINGS|null org default'); return; }

String key = s.LLM_API_Key__c;
Integer keyLen = key == null ? 0 : key.length();
String keyPrefix = (key == null || key.length() < 8) ? String.valueOf(key) : key.substring(0, 8);
System.debug('SETTINGS|engine=[' + s.Engine__c + ']|endpoint=[' + s.LLM_Endpoint__c
    + ']|model=[' + s.LLM_Model__c + ']|keyLen=' + keyLen + '|keyPrefix=[' + keyPrefix + '...]');

if (s.Engine__c != 'External') {
    System.debug('VERDICT|Engine אינו External → זו הסיבה שהמערכת אומרת "אין מנוע חיצוני". תקן בהגדרות.');
    return;
}
if (String.isBlank(s.LLM_Endpoint__c)) {
    System.debug('VERDICT|Endpoint ריק → תקן בהגדרות.'); return;
}

// callout בדיקה
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
        'max_tokens' => 16,
        'messages' => new List<Object>{ new Map<String,Object>{ 'role' => 'user', 'content' => 'ping' } }
    };
    req.setBody(JSON.serialize(body));
    HttpResponse res = new Http().send(req);
    String snippet = res.getBody();
    if (snippet != null && snippet.length() > 300) snippet = snippet.substring(0, 300);
    System.debug('CALLOUT|status=' + res.getStatusCode() + '|body=' + snippet);
    if (res.getStatusCode() == 200) {
        System.debug('VERDICT|המנוע עובד! אם ה-UI עדיין מציג "אין מנוע" — רענון קשיח לניקוי cache.');
    } else {
        System.debug('VERDICT|ההגדרות תקינות אך המפתח/הקרדיט נדחו (קוד ' + res.getStatusCode() + '). ראה body למעלה.');
    }
} catch (Exception e) {
    System.debug('CALLOUT_ERROR|' + e.getMessage() + ' | ודא Remote Site Setting ל-api.anthropic.com פעיל.');
}
