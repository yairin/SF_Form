/**
 * Validates an uploaded file at upload time (before the form is submitted):
 *   1) file-type check — the file extension matches the requested types;
 *   2) content check via Claude (multimodal) — the file really IS the requested
 *      document, and the identifying details in it match the applicant's entered
 *      details. OCR/verification is done by the external LLM (native IDR not licensed).
 *
 * without sharing: called from the public (guest) form context.
 */
public without sharing class FormFileValidationService {

    public class FileVerdict {
        @AuraEnabled public Boolean typeOk;      // extension matches requested types
        @AuraEnabled public Boolean aiChecked;   // AI content check actually ran
        @AuraEnabled public Boolean aiOk;        // AI says correct type AND details match
        @AuraEnabled public String message;      // Hebrew message for the applicant
    }

    private static final Map<String, String> IMG_MEDIA = new Map<String, String>{
        'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg',
        'gif' => 'image/gif', 'webp' => 'image/webp'
    };
    private static final List<String> DEFAULT_MATCH_KEYS = new List<String>{
        'firstName', 'lastName', 'fullName', 'respondentName', 'idNumber'
    };

    @AuraEnabled
    public static FileVerdict validateFile(String docLabel, List<String> acceptExt,
            String fileName, String base64, String applicantJson, List<String> matchKeys) {
        FileVerdict v = new FileVerdict();
        v.typeOk = true;
        v.aiChecked = false;
        v.aiOk = true;

        String ext = fileExt(fileName);

        // 1) type check
        if (acceptExt != null && !acceptExt.isEmpty()) {
            Boolean ok = false;
            for (String a : acceptExt) {
                if (a != null && a.trim().toLowerCase().removeStart('.') == ext) ok = true;
            }
            if (!ok) {
                v.typeOk = false;
                v.message = 'סוג הקובץ אינו מתאים לשדה זה. נדרש: ' + String.join(acceptExt, ', ') + '.';
                return v;
            }
        }

        // 2) AI content check — only for visual docs and only if an external engine is set
        Boolean isPdf = (ext == 'pdf');
        String media = IMG_MEDIA.get(ext);
        if (String.isBlank(base64) || (media == null && !isPdf)) {
            v.message = 'הקובץ התקבל. (בדיקת תוכן אוטומטית זמינה לתמונות/PDF בלבד.)';
            return v;
        }
        Form_AI_Setting__c s = Form_AI_Setting__c.getOrgDefaults();
        if (s == null || s.Engine__c != 'External' || String.isBlank(s.LLM_Endpoint__c)) {
            v.message = 'הקובץ התקבל. (בדיקת תוכן AI אינה מוגדרת.)';
            return v;
        }

        try {
            String applicantSummary = buildApplicantSummary(applicantJson,
                (matchKeys == null || matchKeys.isEmpty()) ? DEFAULT_MATCH_KEYS : matchKeys);
            String label = String.isBlank(docLabel) ? 'המסמך הנדרש' : docLabel;
            String prompt = 'המסמך המצורף אמור להיות: "' + label + '".\n'
                + 'פרטי מגיש הבקשה: ' + applicantSummary + '\n\n'
                + 'קרא את המסמך (OCR) ובדוק: (1) האם הוא אכן מסוג "' + label + '"? '
                + '(2) האם הפרטים המזהים במסמך תואמים לפרטי המגיש? '
                + 'החזר אך ורק JSON תקין: {"isCorrectType":true|false,"detailsMatch":true|false,"notes":"סיכום קצר בעברית"}.';

            Map<String, Object> source = new Map<String, Object>{
                'type' => 'base64',
                'media_type' => isPdf ? 'application/pdf' : media,
                'data' => base64
            };
            List<Object> content = new List<Object>{
                new Map<String, Object>{ 'type' => 'text', 'text' => prompt },
                new Map<String, Object>{ 'type' => (isPdf ? 'document' : 'image'), 'source' => source }
            };

            HttpRequest req = new HttpRequest();
            req.setEndpoint(s.LLM_Endpoint__c);
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setHeader('x-api-key', s.LLM_API_Key__c == null ? '' : s.LLM_API_Key__c);
            req.setHeader('anthropic-version', '2023-06-01');
            if (isPdf) req.setHeader('anthropic-beta', 'pdfs-2024-09-25');
            req.setTimeout(120000);
            req.setBody(JSON.serialize(new Map<String, Object>{
                'model' => String.isBlank(s.LLM_Model__c) ? 'claude-opus-4-8' : s.LLM_Model__c,
                'max_tokens' => 512,
                'messages' => new List<Object>{ new Map<String, Object>{ 'role' => 'user', 'content' => content } }
            }));

            HttpResponse res = new Http().send(req);
            if (res.getStatusCode() != 200) {
                v.message = 'הקובץ התקבל. בדיקת התוכן לא הושלמה כרגע (ננסה שוב בעת הבדיקה).';
                return v;
            }
            Map<String, Object> verdict = parseVerdict(extractText(res.getBody()));
            Boolean isType = verdict.get('isCorrectType') == true;
            Boolean matches = verdict.get('detailsMatch') == true;
            String notes = verdict.get('notes') == null ? '' : String.valueOf(verdict.get('notes'));
            v.aiChecked = true;
            v.aiOk = isType && matches;
            if (!isType) {
                v.message = '⚠ הקובץ אינו נראה כמו "' + label + '". ' + notes;
            } else if (!matches) {
                v.message = '⚠ הפרטים במסמך אינם תואמים לפרטי המבקש. ' + notes;
            } else {
                v.message = '✓ הקובץ אומת: מסוג "' + label + '" ותואם לפרטי המבקש.';
            }
        } catch (Exception e) {
            v.message = 'הקובץ התקבל. בדיקת התוכן לא הושלמה כרגע.';
        }
        return v;
    }

    private static String fileExt(String fileName) {
        if (String.isBlank(fileName) || !fileName.contains('.')) return '';
        return fileName.substringAfterLast('.').toLowerCase();
    }

    private static String buildApplicantSummary(String applicantJson, List<String> keys) {
        if (String.isBlank(applicantJson)) return '(לא סופקו פרטים)';
        List<String> parts = new List<String>();
        try {
            Object parsed = JSON.deserializeUntyped(applicantJson);
            if (parsed instanceof Map<String, Object>) {
                Map<String, Object> m = (Map<String, Object>) parsed;
                for (String k : keys) {
                    if (m.containsKey(k) && m.get(k) != null && String.isNotBlank(String.valueOf(m.get(k)))) {
                        parts.add(k + '=' + String.valueOf(m.get(k)));
                    }
                }
            }
        } catch (Exception e) { /* ignore */ }
        return parts.isEmpty() ? '(לא סופקו פרטים מזהים)' : String.join(parts, ', ');
    }

    private static Map<String, Object> parseVerdict(String text) {
        try {
            String raw = text;
            Integer a = raw.indexOf('{');
            Integer b = raw.lastIndexOf('}');
            if (a >= 0 && b > a) raw = raw.substring(a, b + 1);
            Object parsed = JSON.deserializeUntyped(raw);
            if (parsed instanceof Map<String, Object>) return (Map<String, Object>) parsed;
        } catch (Exception e) { /* fall through */ }
        return new Map<String, Object>();
    }

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
}
