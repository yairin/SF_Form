/**
 * Deterministic, auditable approval decision — the "decision" concern separated
 * from the LLM (which only reads/verifies documents). Models a BRE Decision Table
 * as an ordered rule list; ready to be swapped for a native Business Rules Engine
 * Expression Set / Decision Table when that feature is provisioned.
 *
 * Rule of thumb for the disabled-parking process:
 *   docs incomplete            -> NEEDS_INFO        (complete the file first)
 *   >= 90% & docs complete     -> AUTO_APPROVE
 *   60-89% & docs complete     -> EXCEPTIONS_COMMITTEE
 *   < 60% & docs complete      -> MANUAL_REVIEW
 */
public without sharing class ApprovalDecisionService {

    public class Decision {
        @AuraEnabled public String outcome;   // AUTO_APPROVE | EXCEPTIONS_COMMITTEE | MANUAL_REVIEW | NEEDS_INFO
        @AuraEnabled public String routeTo;   // Hebrew routing label for staff
        @AuraEnabled public String reason;    // human-readable explanation (audit)
        @AuraEnabled public String aiStatus;  // maps to Form_Response__c.AI_Status__c
    }

    // One row of the decision table.
    private class Rule {
        Integer minPct;
        Integer maxPct;
        Boolean requiresDocs;
        String outcome;
        String routeTo;
        Rule(Integer lo, Integer hi, Boolean docs, String outcome, String routeTo) {
            this.minPct = lo; this.maxPct = hi; this.requiresDocs = docs;
            this.outcome = outcome; this.routeTo = routeTo;
        }
    }

    // The decision table (evaluated top-to-bottom; first match wins).
    private static final List<Rule> TABLE = new List<Rule>{
        new Rule(90, 100, true, 'AUTO_APPROVE',          'אישור אוטומטי'),
        new Rule(60, 89,  true, 'EXCEPTIONS_COMMITTEE',  'ועדת חריגים'),
        new Rule(0,  59,  true, 'MANUAL_REVIEW',         'בדיקה ידנית')
    };

    /** Core decision. docsComplete=false always short-circuits to NEEDS_INFO. */
    public static Decision evaluate(Decimal pct, Boolean docsComplete) {
        Decision d = new Decision();
        if (docsComplete != true) {
            d.outcome = 'NEEDS_INFO';
            d.routeTo = 'השלמת מסמכים מול הפונה';
            d.aiStatus = 'Needs_Info';
            d.reason = 'חסרים מסמכים/פרטים — נדרשת השלמה טרם החלטה.';
            return d;
        }
        Integer p = pct == null ? -1 : (Integer) pct.round();
        for (Rule r : TABLE) {
            if (p >= r.minPct && p <= r.maxPct) {
                d.outcome = r.outcome;
                d.routeTo = r.routeTo;
                d.aiStatus = 'Approved'; // AI part complete; routing decided deterministically
                d.reason = 'אחוז נכות ' + p + '% → ' + r.routeTo
                    + (r.outcome == 'AUTO_APPROVE'
                        ? ' (עומד בסף 90% ומעלה).'
                        : r.outcome == 'EXCEPTIONS_COMMITTEE'
                            ? ' (בין 60% ל-89% — מתחת לסף האוטומטי).'
                            : ' (מתחת ל-60% — נדרשת בחינה פרטנית).');
                return d;
            }
        }
        // No numeric percentage available: complete but cannot auto-route.
        d.outcome = 'MANUAL_REVIEW';
        d.routeTo = 'בדיקה ידנית';
        d.aiStatus = 'Approved';
        d.reason = 'המסמכים תקינים אך לא זוהה אחוז נכות מספרי — נדרשת בחינה ידנית.';
        return d;
    }

    /**
     * Reads the numeric percentage from a submission's Response_Data JSON (by key)
     * and applies the decision table. docsComplete is provided by the caller (e.g.
     * from the AI document check, or a Document Checklist Items status).
     */
    public static Decision evaluateForResponse(Id responseId, String pctFieldKey, Boolean docsComplete) {
        Decimal pct = null;
        for (Form_Response__c r : [
            SELECT Response_Data__c FROM Form_Response__c WHERE Id = :responseId LIMIT 1
        ]) {
            pct = extractNumber(r.Response_Data__c, pctFieldKey);
        }
        return evaluate(pct, docsComplete);
    }

    private static Decimal extractNumber(String json, String key) {
        if (String.isBlank(json) || String.isBlank(key)) return null;
        try {
            Object parsed = JSON.deserializeUntyped(json);
            if (parsed instanceof Map<String, Object>) {
                Object v = ((Map<String, Object>) parsed).get(key);
                if (v == null) return null;
                return Decimal.valueOf(String.valueOf(v).trim());
            }
        } catch (Exception e) { /* not numeric / not present */ }
        return null;
    }
}
