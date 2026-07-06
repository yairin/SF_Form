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

    @AuraEnabled
    public static ReviewResult runReview(Id responseId) {
        Form_Response__c r = [
            SELECT Id, Form_Name__c, Form_External_Id__c, Response_Data__c,
                   Respondent_Name__c, Email__c
            FROM Form_Response__c WHERE Id = :responseId LIMIT 1
        ];
        String instructions = '';
        if (String.isNotBlank(r.Form_External_Id__c)) {
            List<Form_Template__c> t = [
                SELECT AI_Review_Instructions__c FROM Form_Template__c
                WHERE External_Id__c = :r.Form_External_Id__c LIMIT 1
            ];
            if (!t.isEmpty() && t[0].AI_Review_Instructions__c != null) {
                instructions = t[0].AI_Review_Instructions__c;
            }
        }

        String prompt = buildPrompt(r, instructions, readAttachments(responseId));

        ReviewResult result;
        Form_AI_Setting__c s = Form_AI_Setting__c.getOrgDefaults();
        String engine = (s != null && String.isNotBlank(s.Engine__c)) ? s.Engine__c : 'Agentforce';
        try {
            if (engine == 'External') {
                result = reviewExternal(s, instructions, prompt);
            } else {
                result = new ReviewResult();
                result.status = 'Error';
                result.findings = 'מנוע Agentforce טרם חובר בארגון. בחר "מנוע חיצוני" בהגדרות (עם endpoint ומפתח), או השלם את חיבור Agentforce.';
            }
        } catch (Exception e) {
            result = new ReviewResult();
            result.status = 'Error';
            result.findings = 'שגיאה בבדיקת AI: ' + e.getMessage();
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

    private static ReviewResult reviewExternal(Form_AI_Setting__c s, String instructions, String prompt) {
        if (s == null || String.isBlank(s.LLM_Endpoint__c)) {
            throw new CalloutException('לא הוגדר endpoint למנוע חיצוני בהגדרות.');
        }
        String systemPrompt = 'אתה בודק טפסים לרשות מקומית. בדוק את ההגשה מול הדרישות. '
            + 'החזר אך ורק JSON תקין במבנה: {"complete": true|false, "missing": ["..."], "notes": "סיכום קצר בעברית"}.';

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
            'system' => systemPrompt,
            'messages' => new List<Object>{ new Map<String, Object>{ 'role' => 'user', 'content' => prompt } }
        };
        req.setBody(JSON.serialize(body));

        HttpResponse res = new Http().send(req);
        String verdictText = extractText(res.getBody());
        return toResult(verdictText);
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
            String json = verdictText;
            Integer a = json.indexOf('{');
            Integer b = json.lastIndexOf('}');
            if (a >= 0 && b > a) json = json.substring(a, b + 1);
            Map<String, Object> v = (Map<String, Object>) JSON.deserializeUntyped(json);
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
