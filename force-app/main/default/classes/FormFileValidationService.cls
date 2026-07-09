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
        AnthropicClient.Config cfg = AnthropicClient.orgConfig();
        if (!cfg.isExternal) {
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

            HttpResponse res = AnthropicClient.sendMessage(cfg.endpoint, cfg.model, cfg.apiKey, null, content, 512);
            if (res.getStatusCode() != 200) {
                v.message = 'הקובץ התקבל. בדיקת התוכן לא הושלמה כרגע (ננסה שוב בעת הבדיקה).';
                return v;
            }
            Map<String, Object> verdict = parseVerdict(AnthropicClient.extractText(res.getBody()));
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
}
