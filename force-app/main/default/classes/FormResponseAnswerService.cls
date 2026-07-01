/**
 * Explodes Form_Response__c.Response_Data__c (a JSON object of answers) into
 * child Form_Answer__c rows so every submitted field becomes reportable.
 *
 * Implemented in Apex (not Flow) on purpose: the answer set has dynamic,
 * per-form keys that are unknown at design time, and Flow cannot iterate the
 * keys of an arbitrary JSON map. Runs in system context via the after-insert
 * trigger, so public (Guest) submissions do not need CRUD on Form_Answer__c.
 */
public without sharing class FormResponseAnswerService {

    private static final Integer TEXT_MAX = 255;

    public static void createAnswers(List<Form_Response__c> responses) {
        List<Form_Answer__c> toInsert = new List<Form_Answer__c>();

        for (Form_Response__c resp : responses) {
            if (String.isBlank(resp.Response_Data__c)) {
                continue;
            }
            Map<String, Object> data;
            try {
                Object parsed = JSON.deserializeUntyped(resp.Response_Data__c);
                if (!(parsed instanceof Map<String, Object>)) {
                    continue;
                }
                data = (Map<String, Object>) parsed;
            } catch (Exception e) {
                // Invalid JSON: skip flattening, keep the raw response intact.
                continue;
            }

            for (String key : data.keySet()) {
                toInsert.add(buildAnswer(resp.Id, key, data.get(key)));
            }
        }

        if (!toInsert.isEmpty()) {
            insert toInsert;
        }
    }

    private static Form_Answer__c buildAnswer(Id responseId, String key, Object value) {
        Form_Answer__c answer = new Form_Answer__c(
            Form_Response__c = responseId,
            Field_Key__c     = truncate(key),
            Field_Label__c   = truncate(key)
        );
        assignValue(answer, value);
        return answer;
    }

    private static void assignValue(Form_Answer__c answer, Object value) {
        if (value == null) {
            return;
        }
        if (value instanceof List<Object>) {
            List<String> parts = new List<String>();
            for (Object item : (List<Object>) value) {
                if (item != null) {
                    parts.add(String.valueOf(item));
                }
            }
            answer.Value_Text__c = truncate(String.join(parts, '; '));
            return;
        }
        if (value instanceof Boolean) {
            answer.Value_Text__c = String.valueOf(value);
            return;
        }
        if (value instanceof Integer || value instanceof Long
                || value instanceof Double || value instanceof Decimal) {
            answer.Value_Text__c = String.valueOf(value);
            try {
                answer.Value_Number__c = Decimal.valueOf(String.valueOf(value));
            } catch (Exception e) {
                // leave numeric field null on any parse issue
            }
            return;
        }

        // String (or nested object rendered as string)
        String text = String.valueOf(value);
        answer.Value_Text__c = truncate(text);
        Date parsedDate = tryParseIsoDate(text);
        if (parsedDate != null) {
            answer.Value_Date__c = parsedDate;
        }
    }

    private static Date tryParseIsoDate(String text) {
        if (text != null && Pattern.matches('^\\d{4}-\\d{2}-\\d{2}$', text)) {
            try {
                return Date.valueOf(text);
            } catch (Exception e) {
                return null;
            }
        }
        return null;
    }

    private static String truncate(String value) {
        if (value != null && value.length() > TEXT_MAX) {
            return value.substring(0, TEXT_MAX);
        }
        return value;
    }
}
