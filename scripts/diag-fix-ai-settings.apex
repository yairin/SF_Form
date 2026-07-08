// אבחון + השלמה של הגדרות המנוע החיצוני (Anthropic/Claude).
// קורא את ברירת המחדל הארגונית; אם קיים מפתח אך המנוע אינו External / חסר endpoint —
// משלים Engine=External ו-Endpoint לכתובת ה-Messages של Anthropic. לעולם לא נוגע במפתח.
String ANTHROPIC = 'https://api.anthropic.com/v1/messages';

Form_AI_Setting__c s = Form_AI_Setting__c.getOrgDefaults();
String engineBefore = (s == null) ? null : s.Engine__c;
String endpointBefore = (s == null) ? null : s.LLM_Endpoint__c;
String modelBefore = (s == null) ? null : s.LLM_Model__c;
Integer keyLen = (s == null || s.LLM_API_Key__c == null) ? 0 : s.LLM_API_Key__c.length();
System.debug('BEFORE|engine=[' + engineBefore + ']|endpoint=[' + endpointBefore + ']|model=[' + modelBefore + ']|keyLen=' + keyLen);

if (s == null || s.Id == null) {
    s = new Form_AI_Setting__c(SetupOwnerId = UserInfo.getOrganizationId());
}

Boolean changed = false;
if (keyLen > 0) {
    if (s.Engine__c != 'External') { s.Engine__c = 'External'; changed = true; }
    if (String.isBlank(s.LLM_Endpoint__c)) { s.LLM_Endpoint__c = ANTHROPIC; changed = true; }
    if (String.isBlank(s.LLM_Model__c)) { s.LLM_Model__c = 'claude-opus-4-8'; changed = true; }
}
if (changed || (s.Id == null)) upsert s;

Form_AI_Setting__c after = Form_AI_Setting__c.getOrgDefaults();
System.debug('AFTER|engine=[' + after.Engine__c + ']|endpoint=[' + after.LLM_Endpoint__c
    + ']|model=[' + after.LLM_Model__c + ']|keyLen='
    + (after.LLM_API_Key__c == null ? 0 : after.LLM_API_Key__c.length()) + '|changed=' + changed);

if (keyLen == 0) {
    System.debug('ACTION|לא קיים מפתח שמור! יש להזין מפתח בהגדרות (טאב ניהול → הגדרות AI). ללא מפתח לא ניתן להפעיל מנוע חיצוני.');
} else {
    System.debug('ACTION|המנוע החיצוני מוגדר כעת. נסה שוב "הפק תובנות AI" / בדיקת AI.');
}
