/**
 * Server-side validation of a submitted payload against its form template schema.
 * Authoritative — the client may validate too, but this is the source of truth
 * (including for anonymous Guest submissions). Returns Hebrew error messages.
 */
public without sharing class FormValidationService {

    private static final Pattern EMAIL = Pattern.compile('^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$');
    private static final Pattern NUMBER = Pattern.compile('^-?\\d+(\\.\\d+)?$');

    /** Returns a list of validation errors; empty list means the payload is valid. */
    public static List<String> validate(String schemaJson, Map<String, Object> values) {
        List<String> errors = new List<String>();
        if (String.isBlank(schemaJson)) return errors;

        List<Object> fields;
        try {
            fields = (List<Object>) JSON.deserializeUntyped(schemaJson);
        } catch (Exception e) {
            return errors; // unparseable schema — nothing to validate against
        }
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
            if (err != null) errors.add(err);
        }
        return errors;
    }

    private static String formatError(String type, String s, String label) {
        if (type == 'email') {
            if (!EMAIL.matcher(s).matches()) return 'כתובת אימייל לא תקינה: ' + label;
        } else if (type == 'phone') {
            String digits = s.replaceAll('\\D', '');
            if (digits.length() < 9 || digits.length() > 15) return 'מספר טלפון לא תקין: ' + label;
        } else if (type == 'number' || type == 'currency') {
            if (!NUMBER.matcher(s).matches()) return 'ערך מספרי לא תקין: ' + label;
        } else if (type == 'idNumber') {
            if (!isValidIsraeliId(s)) return 'תעודת זהות לא תקינה: ' + label;
        } else if (type == 'date') {
            try { Date.valueOf(s); } catch (Exception e) { return 'תאריך לא תקין: ' + label; }
        }
        return null;
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
