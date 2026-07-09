/**
 * Reviews a submitted Form_Response__c with AI: reads the submission data and its
 * attachments, sends them to the engine chosen in Form_AI_Setting__c (Agentforce
 * or an external LLM), and writes a verdict (status + findings) back to the record.
 *
 * The external-LLM path performs an HTTP callout to the configured endpoint; the
 * host must be allowlisted in the org (Remote Site Setting / Named Credential).
 */
public without sharing class FormAIReviewService {

    public class ReviewResult {
        @AuraEnabled public String status;
        @AuraEnabled public String findings;
    }

    public class ReviewInfo {
        @AuraEnabled public String status;
        @AuraEnabled public String findings;
        @AuraEnabled public Datetime reviewedAt;
        @AuraEnabled public String email;
        @AuraEnabled public Boolean updateRequested;
    }

    @AuraEnabled(cacheable=false)
    public static ReviewInfo getReview(Id responseId) {
        Form_Response__c r = [
            SELECT AI_Status__c, AI_Findings__c, AI_Reviewed_At__c, Email__c, Update_Requested__c
            FROM Form_Response__c WHERE Id = :responseId LIMIT 1
        ];
        ReviewInfo info = new ReviewInfo();
        info.status = r.AI_Status__c;
        info.findings = r.AI_Findings__c;
        info.reviewedAt = r.AI_Reviewed_At__c;
        info.email = r.Email__c;
        info.updateRequested = r.Update_Requested__c;
        return info;
    }

    /** Emails the applicant a link to complete missing items (proactive outreach). */
    @AuraEnabled
    public static void requestCompletion(Id responseId) {
        Form_Response__c r = [
            SELECT Id, Email__c, Form_External_Id__c, Form_Name__c, AI_Findings__c, Update_Token__c
            FROM Form_Response__c WHERE Id = :responseId LIMIT 1
        ];
        if (String.isBlank(r.Email__c)) {
            throw new AuraHandledException('לפונה אין כתובת אימייל לשליחת בקשת השלמה.');
        }
        if (String.isBlank(r.Update_Token__c)) {
            r.Update_Token__c = generateToken();
        }
        r.Update_Requested__c = true;
        update r;

        String base = System.Label.Form_Public_Site_Base_Url;
        String link = base;
        if (String.isNotBlank(base) && String.isNotBlank(r.Form_External_Id__c)) {
            link = base + (base.contains('?') ? '&' : '?')
                + 'formId=' + EncodingUtil.urlEncode(r.Form_External_Id__c, 'UTF-8')
                + '&token=' + r.Update_Token__c;
        }
        Messaging.SingleEmailMessage m = new Messaging.SingleEmailMessage();
        m.setToAddresses(new List<String>{ r.Email__c });
        m.setSubject('נדרשת השלמת פרטים לפנייתך: ' + r.Form_Name__c);
        m.setPlainTextBody(
            'שלום,\n\nבבדיקת פנייתך נמצא שנדרשת השלמה:\n'
            + (r.AI_Findings__c == null ? '' : r.AI_Findings__c)
            + '\n\nלהשלמת הפרטים: ' + link + '\n\nתודה.'
        );
        m.setSaveAsActivity(false);
        try {
            Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ m });
        } catch (Exception e) {
            // Email deliverability may be off in a sandbox; the request is still recorded.
        }
    }

    private static String generateToken() {
        return EncodingUtil.convertToHex(Crypto.generateAesKey(128));
    }

    @AuraEnabled
    public static ReviewResult runReview(Id responseId) {
        Form_Response__c r = [
            SELECT Id, Form_Name__c, Form_External_Id__c, Response_Data__c,
                   Respondent_Name__c, Email__c,
                   Authority__r.AI_Engine__c, Authority__r.LLM_Endpoint__c,
                   Authority__r.LLM_Model__c, Authority__r.LLM_API_Key__c
            FROM Form_Response__c WHERE Id = :responseId LIMIT 1
        ];
        String instructions = '';
        if (String.isNotBlank(r.Form_External_Id__c)) {
            List<Form_Template__c> t = [
                SELECT AI_Review_Instructions__c, AI_Check_Attachments__c, AI_Contact_Applicant__c
                FROM Form_Template__c
                WHERE External_Id__c = :r.Form_External_Id__c LIMIT 1
            ];
            if (!t.isEmpty()) {
                if (t[0].AI_Review_Instructions__c != null) instructions = t[0].AI_Review_Instructions__c;
                if (t[0].AI_Check_Attachments__c == true) {
                    instructions += '\n- ודא שכל הקבצים המצורפים קריאים ותואמים למסמכים הנדרשים.';
                }
                if (t[0].AI_Contact_Applicant__c == true) {
                    instructions += '\n- אם חסר מידע או מסמך, ציין במפורש מה חסר כדי שנפנה לפונה להשלמה.';
                }
            }
        }

        String prompt = buildPrompt(r, instructions, readAttachments(responseId));

        // Resolve config per authority (tenant), falling back to the org default.
        Form_AI_Setting__c s = Form_AI_Setting__c.getOrgDefaults();
        String engine = coalesce(r.Authority__r == null ? null : r.Authority__r.AI_Engine__c,
                                  s == null ? null : s.Engine__c, 'Agentforce');
        String endpoint = coalesce(r.Authority__r == null ? null : r.Authority__r.LLM_Endpoint__c,
                                   s == null ? null : s.LLM_Endpoint__c, null);
        String model = coalesce(r.Authority__r == null ? null : r.Authority__r.LLM_Model__c,
                                s == null ? null : s.LLM_Model__c, null);
        String apiKey = coalesce(r.Authority__r == null ? null : r.Authority__r.LLM_API_Key__c,
                                 s == null ? null : s.LLM_API_Key__c, null);

        ReviewResult result;
        try {
            if (engine == 'External') {
                result = reviewExternal(endpoint, model, apiKey, prompt);
            } else {
                result = new ReviewResult();
                result.status = 'Error';
                result.findings = 'לא הוגדר מנוע AI פעיל. עבור לטאב "ניהול" → "הגדרות AI", בחר "מנוע חיצוני (LLM דרך API)" והזן endpoint ומפתח, או השלם את חיבור Agentforce.';
            }
        } catch (Exception e) {
            result = new ReviewResult();
            result.status = 'Error';
            result.findings = 'שגיאה בבדיקת AI: ' + e.getMessage();
        }

        // Deterministic routing decision (BRE-style), separated from the LLM: the AI
        // only verifies documents; the approve/committee/review routing is decided by
        // an auditable decision table when the submission carries a numeric decision
        // field (e.g. disabilityPct). Generic forms without such a field are unaffected.
        if (result != null && result.status != 'Error'
            && r.Response_Data__c != null && r.Response_Data__c.contains('disabilityPct')) {
            Boolean docsComplete = (result.status == 'Approved');
            ApprovalDecisionService.Decision dec =
                ApprovalDecisionService.evaluateForResponse(r.Id, 'disabilityPct', docsComplete);
            if (dec != null && dec.outcome != null) {
                result.status = dec.aiStatus;
                result.findings = (String.isBlank(result.findings) ? '' : result.findings + '\n\n')
                    + 'החלטת ניתוב (אוטומטית, ניתנת לביקורת): ' + dec.routeTo + ' — ' + dec.reason;
            }
        }

        r.AI_Status__c = result.status;
        r.AI_Findings__c = result.findings;
        r.AI_Reviewed_At__c = System.now();
        update r;
        return result;
    }

    private static String readAttachments(Id responseId) {
        Set<Id> docIds = new Set<Id>();
        for (ContentDocumentLink l : [SELECT ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = :responseId]) {
            docIds.add(l.ContentDocumentId);
        }
        if (docIds.isEmpty()) return 'אין צרופות.';
        List<String> parts = new List<String>();
        for (ContentVersion cv : [
            SELECT Title, FileType, FileExtension, ContentSize, VersionData
            FROM ContentVersion WHERE ContentDocumentId IN :docIds AND IsLatest = true
        ]) {
            String text = '';
            Set<String> textExt = new Set<String>{ 'txt', 'csv', 'json', 'xml', 'md', 'html' };
            if (cv.FileExtension != null && textExt.contains(cv.FileExtension.toLowerCase())) {
                try { text = cv.VersionData.toString(); } catch (Exception e) { text = ''; }
            }
            String line = '- ' + cv.Title + ' (' + cv.FileType + ', ' + cv.ContentSize + ' bytes)';
            if (String.isNotBlank(text)) line += '\nתוכן:\n' + text.left(4000);
            else line += ' [לא ניתן לחלץ טקסט אוטומטית — נדרש OCR]';
            parts.add(line);
        }
        return String.join(parts, '\n');
    }

    private static String buildPrompt(Form_Response__c r, String instructions, String attachments) {
        return 'טופס: ' + r.Form_Name__c
            + '\nממלא: ' + r.Respondent_Name__c + ' <' + r.Email__c + '>'
            + '\nנתוני ההגשה (JSON): ' + r.Response_Data__c
            + '\nצרופות:\n' + attachments
            + '\n\nמה נדרש לוודא:\n' + (String.isBlank(instructions) ? 'ודא שההגשה מלאה והצרופות מתאימות.' : instructions);
    }

    /**
     * Generic narrative helper for analytics: sends a prompt to the org-default
     * external LLM and returns the text, or null if no external engine is configured
     * (callers fall back to a rule-based summary).
     */
    public static String narrate(String userPrompt) {
        Form_AI_Setting__c s = Form_AI_Setting__c.getOrgDefaults();
        if (s == null || s.Engine__c != 'External' || String.isBlank(s.LLM_Endpoint__c)) {
            return null;
        }
        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint(s.LLM_Endpoint__c);
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setHeader('x-api-key', s.LLM_API_Key__c == null ? '' : s.LLM_API_Key__c);
            req.setHeader('anthropic-version', '2023-06-01');
            req.setTimeout(120000);
            Map<String, Object> body = new Map<String, Object>{
                'model' => String.isBlank(s.LLM_Model__c) ? 'claude-opus-4-8' : s.LLM_Model__c,
                'max_tokens' => 1024,
                'system' => 'אתה אנליסט נתונים לרשות מקומית. ספק תובנות קצרות, ברורות ומועילות בעברית על תוצאות הטופס.',
                'messages' => new List<Object>{ new Map<String, Object>{ 'role' => 'user', 'content' => userPrompt } }
            };
            req.setBody(JSON.serialize(body));
            HttpResponse resp = new Http().send(req);
            if (resp.getStatusCode() != 200) return null; // e.g. low credit / bad key -> caller falls back
            String txt = extractText(resp.getBody());
            // if the body wasn't a valid content response, don't surface raw JSON
            return (txt != null && txt.startsWith('{')) ? null : txt;
        } catch (Exception e) {
            return null;
        }
    }

    private static String coalesce(String a, String b, String c) {
        if (String.isNotBlank(a)) return a;
        if (String.isNotBlank(b)) return b;
        return c;
    }

    private static ReviewResult reviewExternal(String endpoint, String model, String apiKey, String prompt) {
        if (String.isBlank(endpoint)) {
            throw new CalloutException('לא הוגדר endpoint למנוע חיצוני (ברמת הרשות או ברירת המחדל).');
        }
        String systemPrompt = 'אתה בודק טפסים לרשות מקומית. בדוק את ההגשה מול הדרישות. '
            + 'החזר אך ורק JSON תקין במבנה: {"complete": true|false, "missing": ["..."], "notes": "סיכום קצר בעברית"}.';

        HttpRequest req = new HttpRequest();
        req.setEndpoint(endpoint);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('x-api-key', apiKey == null ? '' : apiKey);
        req.setHeader('anthropic-version', '2023-06-01');
        req.setTimeout(120000);
        Map<String, Object> body = new Map<String, Object>{
            'model' => String.isBlank(model) ? 'claude-opus-4-8' : model,
            'max_tokens' => 1024,
            'system' => systemPrompt,
            'messages' => new List<Object>{ new Map<String, Object>{ 'role' => 'user', 'content' => prompt } }
        };
        req.setBody(JSON.serialize(body));

        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() != 200) {
            ReviewResult err = new ReviewResult();
            err.status = 'Error';
            err.findings = 'שגיאת מנוע AI (קוד ' + res.getStatusCode() + '): ' + describeApiError(res.getBody());
            return err;
        }
        String verdictText = extractText(res.getBody());
        return toResult(verdictText);
    }

    /**
     * Turns an Anthropic-style error body ({"error":{"message":"..."}}) into a
     * short, human-readable Hebrew explanation. Recognizes the common
     * "credit balance too low" and auth cases so the card shows a real cause.
     */
    private static String describeApiError(String responseBody) {
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

    /** Pull the assistant text out of an Anthropic-style response, else return the raw body. */
    private static String extractText(String responseBody) {
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

    private static ReviewResult toResult(String verdictText) {
        ReviewResult out = new ReviewResult();
        try {
            String raw = verdictText;
            Integer a = raw.indexOf('{');
            Integer b = raw.lastIndexOf('}');
            if (a >= 0 && b > a) raw = raw.substring(a, b + 1);
            Map<String, Object> v = (Map<String, Object>) JSON.deserializeUntyped(raw);
            Boolean complete = v.get('complete') == true;
            List<Object> missing = (v.get('missing') instanceof List<Object>) ? (List<Object>) v.get('missing') : new List<Object>();
            String notes = v.get('notes') == null ? '' : String.valueOf(v.get('notes'));
            out.status = complete ? 'Approved' : 'Needs_Info';
            String findings = notes;
            if (!missing.isEmpty()) {
                List<String> m = new List<String>();
                for (Object o : missing) m.add('• ' + String.valueOf(o));
                findings += '\n\nחסר:\n' + String.join(m, '\n');
            }
            out.findings = String.isBlank(findings) ? 'הבדיקה הושלמה.' : findings;
        } catch (Exception e) {
            out.status = 'Needs_Info';
            out.findings = verdictText;
        }
        return out;
    }
}
