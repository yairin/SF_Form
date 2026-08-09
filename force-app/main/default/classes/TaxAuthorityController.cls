/**
 * Seam for the future רשות המסים (Israeli Tax Authority) income-data API, used by
 * the Ask-Once (שאל פעם אחת) arnona-discount form to pre-fill the applicant's
 * income fields as read-only.
 *
 * STATUS: the real integration is NOT YET AVAILABLE. This returns available=false
 * with a Hebrew "pending" message so the form renders the income fields as locked
 * and empty, prompts the applicant to attach the source documents, and never breaks.
 *
 * When the API is built, wire the callout HERE, THROUGH A NAMED CREDENTIAL
 * (secure-development directive 5.35 §7 — no endpoints/secrets in code), and map the
 * response into IncomeData. Keep it Guest-safe: any failure returns available=false.
 *
 * Security (5.35): with sharing; server-side input validation (never trust the
 * client); no PII is logged; cacheable read-only method (no DML).
 */
public with sharing class TaxAuthorityController {

    // One 106 line (per employer): taxable income + employer label.
    public class Form106Row {
        @AuraEnabled public String employer;
        @AuraEnabled public Decimal taxableIncome;
    }

    public class IncomeData {
        @AuraEnabled public Boolean available = false;
        @AuraEnabled public String message;
        @AuraEnabled public Integer employerCount;
        @AuraEnabled public List<Form106Row> form106 = new List<Form106Row>();
    }

    private static final String PENDING_MSG =
        'נתוני ההכנסה יימשכו אוטומטית ממערכת רשות המסים לאחר חיבור הממשק (עקרון "שאל פעם אחת"). '
        + 'בשלב זה יש לצרף את מסמכי המקור (טופס 106 / תיאום מס / דוח שנתי).';

    /**
     * Returns the applicant's income data for the given national id, or a pending
     * response while the Tax Authority API is not yet connected.
     */
    @AuraEnabled(cacheable=true)
    public static IncomeData getIncomeData(String idNumber) {
        IncomeData d = new IncomeData();
        // Server-side input validation — a 9-digit Israeli id (never trust the client).
        String id = (idNumber == null) ? '' : idNumber.trim();
        if (String.isBlank(id) || !Pattern.matches('^[0-9]{1,9}$', id)) {
            d.available = false;
            d.message = 'לא ניתן למשוך נתוני הכנסה ללא מספר זהות תקין.';
            return d;
        }

        // === SEAM: the real רשות המסים callout goes here, via a Named Credential. ===
        // Example (when available):
        //   HttpRequest req = new HttpRequest();
        //   req.setEndpoint('callout:Tax_Authority/income?id=' + EncodingUtil.urlEncode(id,'UTF-8'));
        //   ... parse response into d.form106 / d.employerCount ; d.available = true ;
        //
        // Until then, return a non-blocking "pending" result.
        d.available = false;
        d.message = PENDING_MSG;
        return d;
    }
}
