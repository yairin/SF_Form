/**
 * Server-side validation of a submitted payload against its form template schema.
 * Authoritative — the client may validate too, but this is the source of truth
 * (including for anonymous Guest submissions). Returns Hebrew error messages.
 */
public without sharing class FormValidationService {

    private static final Pattern EMAIL_RE = Pattern.compile('^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$');
    private static final Pattern NUMBER_RE = Pattern.compile('^-?\\d+(\\.\\d+)?$');

    /** Returns a list of validation errors; empty list means the payload is valid. */
    public static List<String> validate(String schemaJson, Map<String, Object> values) {
        List<String> errors = new List<String>();
        List<Object> fields = flattenFields(schemaJson);
        if (fields.isEmpty()) return errors;
        if (values == null) values = new Map<String, Object>();

        for (Object fo : fields) {
            if (!(fo instanceof Map<String, Object>)) continue;
            Map<String, Object> f = (Map<String, Object>) fo;
            String key = (String) f.get('key');
            String label = f.get('label') == null ? key : (String) f.get('label');
            String type = (String) f.get('type');
            Boolean required = f.get('required') == true;

            Object v = key == null ? null : values.get(key);
            String s = (v == null) ? '' : String.valueOf(v).trim();

            if (String.isBlank(s)) {
                if (required) errors.add('שדה חובה חסר: ' + label);
                continue;
            }
            String err = formatError(type, s, label);
            if (err == null) err = constraintError(f, type, s, label);
            if (err != null) errors.add(err);
        }
        return errors;
    }

    /**
     * Returns the flat list of field maps from a schema that may be a plain array
     * (legacy single-step) or an object { "steps": [ { "fields": [...] } ] } / { "fields": [...] }.
     */
    public static List<Object> flattenFields(String schemaJson) {
        List<Object> fields = new List<Object>();
        if (String.isBlank(schemaJson)) return fields;
        Object parsed;
        try {
            parsed = JSON.deserializeUntyped(schemaJson);
        } catch (Exception e) {
            return fields;
        }
        if (parsed instanceof List<Object>) {
            fields.addAll((List<Object>) parsed);
        } else if (parsed instanceof Map<String, Object>) {
            Map<String, Object> m = (Map<String, Object>) parsed;
            if (m.get('steps') instanceof List<Object>) {
                for (Object so : (List<Object>) m.get('steps')) {
                    if (so instanceof Map<String, Object>) {
                        Object fs = ((Map<String, Object>) so).get('fields');
                        if (fs instanceof List<Object>) fields.addAll((List<Object>) fs);
                    }
                }
            } else if (m.get('fields') instanceof List<Object>) {
                fields.addAll((List<Object>) m.get('fields'));
            }
        }
        return fields;
    }

    private static String formatError(String type, String s, String label) {
        if (type == 'email') {
            if (!EMAIL_RE.matcher(s).matches()) return 'כתובת אימייל לא תקינה: ' + label;
        } else if (type == 'phone') {
            String digits = s.replaceAll('\\D', '');
            if (digits.length() < 9 || digits.length() > 15) return 'מספר טלפון לא תקין: ' + label;
        } else if (type == 'number' || type == 'currency') {
            if (!NUMBER_RE.matcher(s).matches()) return 'ערך מספרי לא תקין: ' + label;
        } else if (type == 'idNumber') {
            if (!isValidIsraeliId(s)) return 'תעודת זהות לא תקינה: ' + label;
        } else if (type == 'age') {
            if (!s.isNumeric()) return 'גיל לא תקין: ' + label;
            // Use Decimal, not Integer.valueOf: a long numeric string ("99999999999") is
            // isNumeric()==true but overflows Integer and throws a TypeException.
            Decimal a;
            try { a = Decimal.valueOf(s); } catch (Exception e) { return 'גיל לא תקין: ' + label; }
            if (a < 0 || a > 120) return 'גיל לא תקין: ' + label;
        } else if (type == 'date') {
            try { Date.valueOf(s); } catch (Exception e) { return 'תאריך לא תקין: ' + label; }
        }
        return null;
    }

    private static final Pattern WS_RE = Pattern.compile('\\s');
    private static final Pattern SPECIAL_RE = Pattern.compile('[^0-9A-Za-z\\u0590-\\u05FF ]');

    /**
     * Optional per-field validation configured in the builder: numeric range for
     * number/currency, and length + character rules for short text. Authoritative
     * mirror of the client-side constraintError in dynamicForm.
     */
    private static String constraintError(Map<String, Object> f, String type, String s, String label) {
        if ((type == 'number' || type == 'currency') && NUMBER_RE.matcher(s).matches()) {
            Decimal n = Decimal.valueOf(s);
            Decimal mn = numOf(f.get('min'));
            Decimal mx = numOf(f.get('max'));
            if (mn != null && n < mn) return 'הערך חייב להיות לפחות ' + mn + ': ' + label;
            if (mx != null && n > mx) return 'הערך חייב להיות עד ' + mx + ': ' + label;
        } else if (type == 'text') {
            Integer minLen = intOf(f.get('minLen'));
            Integer maxLen = intOf(f.get('maxLen'));
            if (minLen != null && s.length() < minLen) return 'נדרשים לפחות ' + minLen + ' תווים: ' + label;
            if (maxLen != null && s.length() > maxLen) return 'מותר עד ' + maxLen + ' תווים: ' + label;
            if (f.get('allowSpaces') == false && WS_RE.matcher(s).find()) return 'אסור להזין רווחים: ' + label;
            if (f.get('allowSpecial') == false && SPECIAL_RE.matcher(s).find()) return 'מותרים אותיות ומספרים בלבד: ' + label;
        }
        return null;
    }

    private static Decimal numOf(Object o) {
        if (o == null) return null;
        try { return Decimal.valueOf(String.valueOf(o)); } catch (Exception e) { return null; }
    }
    private static Integer intOf(Object o) {
        if (o == null) return null;
        try { return Decimal.valueOf(String.valueOf(o)).intValue(); } catch (Exception e) { return null; }
    }

    /** Israeli national ID (תעודת זהות) check-digit validation. */
    public static Boolean isValidIsraeliId(String id) {
        if (id == null) return false;
        String digits = id.replaceAll('\\D', '');
        if (digits.length() == 0 || digits.length() > 9) return false;
        while (digits.length() < 9) digits = '0' + digits;
        Integer sum = 0;
        for (Integer i = 0; i < 9; i++) {
            Integer d = Integer.valueOf(digits.substring(i, i + 1));
            Integer p = d * (Math.mod(i, 2) == 0 ? 1 : 2);
            if (p > 9) p -= 9;
            sum += p;
        }
        return Math.mod(sum, 10) == 0;
    }
}
