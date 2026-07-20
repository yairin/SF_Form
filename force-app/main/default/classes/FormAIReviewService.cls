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
                // Claude is multimodal: send the attached images/PDFs so it performs
                // OCR + data extraction itself (native IDR not licensed in this org).
                result = reviewExternal(endpoint, model, apiKey, prompt, attachmentBlocks(responseId));
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
                // stamp the structured route so the native approval process + reports can use it
                Map<String, String> routeApi = new Map<String, String>{
                    'AUTO_APPROVE' => 'Auto_Approve',
                    'EXCEPTIONS_COMMITTEE' => 'Exceptions_Committee',
                    'MANUAL_REVIEW' => 'Manual_Review',
                    'NEEDS_INFO' => 'Needs_Info'
                };
                if (routeApi.containsKey(dec.outcome)) r.Approval_Route__c = routeApi.get(dec.outcome);
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
            else line += ' [תמונה/PDF — נשלח לקלוד לקריאה (OCR)]';
            parts.add(line);
        }
        return String.join(parts, '\n');
    }

    private static String buildPrompt(Form_Response__c r, String instructions, String attachments) {
        return 'טופס: ' + r.Form_Name__c
            + '\nממלא: ' + r.Respondent_Name__c + ' <' + r.Email__c + '>'
            + '\nנתוני ההגשה (JSON): ' + r.Response_Data__c
            + '\nרשימת צרופות:\n' + attachments
            + '\n\nהמסמכים המצורפים (תמונות/PDF) צורפו להודעה זו — קרא אותם בעצמך (OCR), '
            + 'חלץ מהם את הנתונים הרלוונטיים, והשווה מול נתוני ההגשה והדרישות.'
            + '\n\nחשוב: אם צורף מסמך זיהוי (תעודת זהות/דרכון), חלץ ממנו את השם המלא ומספר הזהות '
            + 'וּוַדֵּא שהם תואמים לשם ולתעודת הזהות שהוזנו בטופס. אם יש אי-התאמה בשם או במספר — '
            + 'ציין זאת מפורשות תחת "missing"/"notes" וסמן שההגשה אינה שלמה.'
            + '\n\nמה נדרש לוודא:\n' + (String.isBlank(instructions) ? 'ודא שההגשה מלאה והצרופות מתאימות.' : instructions);
    }

    private static final Map<String, String> IMG_MEDIA = new Map<String, String>{
        'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg',
        'gif' => 'image/gif', 'webp' => 'image/webp'
    };

    /**
     * Builds Anthropic multimodal content blocks (base64) for a response's image/PDF
     * attachments, so Claude can OCR and read them directly. Skips non-visual files,
     * files > 3MB (heap/callout guard), and caps at 5 files.
     */
    private static List<Object> attachmentBlocks(Id responseId) {
        List<Object> blocks = new List<Object>();
        Set<Id> docIds = new Set<Id>();
        for (ContentDocumentLink l : [
            SELECT ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = :responseId
        ]) {
            docIds.add(l.ContentDocumentId);
        }
        if (docIds.isEmpty()) return blocks;
        Integer count = 0;
        for (ContentVersion cv : [
            SELECT FileExtension, ContentSize, VersionData
            FROM ContentVersion WHERE ContentDocumentId IN :docIds AND IsLatest = true
            ORDER BY ContentSize ASC
        ]) {
            if (count >= 5) break;
            String ext = cv.FileExtension == null ? '' : cv.FileExtension.toLowerCase();
            Boolean isPdf = (ext == 'pdf');
            String media = IMG_MEDIA.get(ext);
            if (media == null && !isPdf) continue;                 // only images / PDF go to vision
            if (cv.ContentSize == null || cv.ContentSize > 3000000) continue; // size guard
            String b64;
            try { b64 = EncodingUtil.base64Encode(cv.VersionData); } catch (Exception e) { continue; }
            Map<String, Object> source = new Map<String, Object>{
                'type' => 'base64',
                'media_type' => isPdf ? 'application/pdf' : media,
                'data' => b64
            };
            blocks.add(new Map<String, Object>{
                'type' => isPdf ? 'document' : 'image',
                'source' => source
            });
            count++;
        }
        return blocks;
    }

    /**
     * Generic narrative helper for analytics: sends a prompt to the org-default
     * external LLM and returns the text, or null if no external engine is configured
     * (callers fall back to a rule-based summary).
     */
    public static String narrate(String userPrompt) {
        AnthropicClient.Config cfg = AnthropicClient.orgConfig();
        if (!cfg.isExternal) return null;
        try {
            HttpResponse resp = AnthropicClient.sendMessage(cfg.endpoint, cfg.model, cfg.apiKey,
                'אתה אנליסט נתונים לרשות מקומית. ספק תובנות קצרות, ברורות ומועילות בעברית על תוצאות הטופס.',
                userPrompt, 1024);
            if (resp.getStatusCode() != 200) return null; // e.g. low credit / bad key -> caller falls back
            String txt = AnthropicClient.extractText(resp.getBody());
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

    private static ReviewResult reviewExternal(String endpoint, String model, String apiKey, String prompt, List<Object> mediaBlocks) {
        if (String.isBlank(endpoint)) {
            throw new CalloutException('לא הוגדר endpoint למנוע חיצוני (ברמת הרשות או ברירת המחדל).');
        }
        String systemPrompt = 'אתה בודק טפסים לרשות מקומית. קרא בעצמך את המסמכים המצורפים (OCR) '
            + 'וחלץ מהם נתונים, בדוק את ההגשה מול הדרישות. '
            + 'החזר אך ורק JSON תקין במבנה: {"complete": true|false, "missing": ["..."], "notes": "סיכום קצר בעברית"}.';

        // multimodal content: the text prompt followed by any image/PDF attachment blocks
        List<Object> content = new List<Object>{ new Map<String, Object>{ 'type' => 'text', 'text' => prompt } };
        if (mediaBlocks != null) content.addAll(mediaBlocks);

        HttpResponse res = AnthropicClient.sendMessage(endpoint, model, apiKey, systemPrompt, content, 1024);
        if (res.getStatusCode() != 200) {
            ReviewResult err = new ReviewResult();
            err.status = 'Error';
            err.findings = 'שגיאת מנוע AI (קוד ' + res.getStatusCode() + '): ' + AnthropicClient.describeApiError(res.getBody());
            return err;
        }
        return toResult(AnthropicClient.extractText(res.getBody()));
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
