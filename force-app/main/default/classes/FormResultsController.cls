/**
 * Aggregates the submissions of a form into per-field distributions/stats and a
 * summary, for the Results tab. with sharing so per-authority restriction rules
 * apply (managers see only their authority's data).
 */
public with sharing class FormResultsController {

    public class Bucket {
        @AuraEnabled public String label;
        @AuraEnabled public Integer count;
        @AuraEnabled public Integer percent;
    }
    public class FieldResult {
        @AuraEnabled public String key;
        @AuraEnabled public String label;
        @AuraEnabled public String type;
        @AuraEnabled public Boolean isBar;
        @AuraEnabled public Boolean isStat;
        @AuraEnabled public Integer filled;
        @AuraEnabled public List<Bucket> buckets;
        @AuraEnabled public Decimal avg;
        @AuraEnabled public Decimal minV;
        @AuraEnabled public Decimal maxV;
    }
    public class Results {
        @AuraEnabled public String formName;
        @AuraEnabled public String externalId;
        @AuraEnabled public Integer total;
        @AuraEnabled public Integer approved;
        @AuraEnabled public Integer needsInfo;
        @AuraEnabled public Integer pending;
        @AuraEnabled public List<FieldResult> fields;
        @AuraEnabled public String summary;
        // Persisted AI insights (shown on later visits, before/without regenerating).
        @AuraEnabled public String insights;
        @AuraEnabled public Datetime insightsGeneratedAt;
        @AuraEnabled public Integer insightsCount;
    }

    /** Result of generating (and persisting) AI insights. */
    public class Insights {
        @AuraEnabled public String text;
        @AuraEnabled public Datetime generatedAt;
        @AuraEnabled public Integer count;
    }

    private static final Set<String> CAT = new Set<String>{ 'select', 'radio', 'checkbox', 'checkboxGroup' };

    // Not cacheable: results must reflect newly submitted responses immediately
    // (a stale client cache otherwise shows 0 after new submissions).
    @AuraEnabled
    public static Results getResults(String externalId) {
        Results res = new Results();
        res.externalId = externalId;
        res.fields = new List<FieldResult>();
        res.total = 0;

        List<Form_Template__c> tpls = [
            SELECT Name, Schema_JSON__c, AI_Insights__c, AI_Insights_Generated_At__c, AI_Insights_Record_Count__c
            FROM Form_Template__c WHERE External_Id__c = :externalId LIMIT 1
        ];
        if (tpls.isEmpty()) { res.summary = 'הטופס לא נמצא.'; return res; }
        res.formName = tpls[0].Name;
        res.insights = tpls[0].AI_Insights__c;
        res.insightsGeneratedAt = tpls[0].AI_Insights_Generated_At__c;
        res.insightsCount = tpls[0].AI_Insights_Record_Count__c == null
            ? null : (Integer) tpls[0].AI_Insights_Record_Count__c;

        List<Object> schemaFields = FormValidationService.flattenFields(tpls[0].Schema_JSON__c);

        List<Map<String, Object>> payloads = new List<Map<String, Object>>();
        Integer approved = 0, needsInfo = 0, pending = 0;
        for (Form_Response__c r : [
            SELECT Response_Data__c, AI_Status__c FROM Form_Response__c WHERE Form_External_Id__c = :externalId
        ]) {
            try { payloads.add((Map<String, Object>) JSON.deserializeUntyped(r.Response_Data__c)); }
            catch (Exception e) { /* skip malformed */ }
            if (r.AI_Status__c == 'Approved') approved++;
            else if (r.AI_Status__c == 'Needs_Info') needsInfo++;
            else pending++;
        }
        res.total = payloads.size();
        res.approved = approved;
        res.needsInfo = needsInfo;
        res.pending = pending;

        for (Object fo : schemaFields) {
            if (!(fo instanceof Map<String, Object>)) continue;
            Map<String, Object> f = (Map<String, Object>) fo;
            String key = (String) f.get('key');
            String type = (String) f.get('type');
            FieldResult fr = new FieldResult();
            fr.key = key;
            fr.label = f.get('label') == null ? key : (String) f.get('label');
            fr.type = type;

            if (CAT.contains(type)) {
                fr.isBar = true;
                Map<String, Integer> counts = new Map<String, Integer>();
                Integer nonEmpty = 0;
                for (Map<String, Object> p : payloads) {
                    Object v = key == null ? null : p.get(key);
                    if (v == null) continue;
                    String sv = String.valueOf(v).trim();
                    if (String.isBlank(sv)) continue;
                    nonEmpty++;
                    for (String part : sv.split(';')) {
                        String t = part.trim();
                        if (String.isBlank(t)) continue;
                        counts.put(t, (counts.containsKey(t) ? counts.get(t) : 0) + 1);
                    }
                }
                fr.filled = nonEmpty;
                fr.buckets = new List<Bucket>();
                Integer denom = nonEmpty == 0 ? 1 : nonEmpty;
                for (String k : counts.keySet()) {
                    Bucket b = new Bucket();
                    b.label = k;
                    b.count = counts.get(k);
                    b.percent = (Integer) Math.round(100.0 * counts.get(k) / denom);
                    fr.buckets.add(b);
                }
            } else if (type == 'number' || type == 'currency') {
                fr.isStat = true;
                Decimal sum = 0; Integer c = 0; Decimal mn = null; Decimal mx = null;
                for (Map<String, Object> p : payloads) {
                    Object v = key == null ? null : p.get(key);
                    if (v == null) continue;
                    try {
                        Decimal d = Decimal.valueOf(String.valueOf(v).trim());
                        sum += d; c++;
                        if (mn == null || d < mn) mn = d;
                        if (mx == null || d > mx) mx = d;
                    } catch (Exception e) { /* non-numeric */ }
                }
                fr.filled = c;
                if (c > 0) { fr.avg = (sum / c).setScale(2); fr.minV = mn; fr.maxV = mx; }
            } else {
                Integer c = 0;
                for (Map<String, Object> p : payloads) {
                    Object v = key == null ? null : p.get(key);
                    if (v != null && String.isNotBlank(String.valueOf(v))) c++;
                }
                fr.filled = c;
            }
            res.fields.add(fr);
        }
        res.summary = buildSummary(res);
        return res;
    }

    /**
     * Generates AI insights (LLM-enriched when an external engine is configured,
     * else the rule-based summary) and PERSISTS them on the template with the
     * generation timestamp and record count, so they show on later visits.
     */
    @AuraEnabled
    public static Insights generateAiInsights(String externalId) {
        Results r = getResults(externalId);
        String text;
        if (r.total == 0) {
            text = r.summary;
        } else {
            String prompt = 'תוצאות הטופס "' + r.formName + '" (' + r.total + ' הגשות):\n'
                + aggregationText(r) + '\n\nספק 3–5 תובנות קצרות ומועילות בעברית.';
            String ai = FormAIReviewService.narrate(prompt);
            text = String.isBlank(ai) ? r.summary : ai;
        }

        Datetime generatedAt = System.now();
        List<Form_Template__c> tpls = [
            SELECT Id FROM Form_Template__c WHERE External_Id__c = :externalId LIMIT 1
        ];
        if (!tpls.isEmpty()) {
            Form_Template__c t = tpls[0];
            t.AI_Insights__c = text;
            t.AI_Insights_Generated_At__c = generatedAt;
            t.AI_Insights_Record_Count__c = r.total;
            update t;
        }

        Insights out = new Insights();
        out.text = text;
        out.generatedAt = generatedAt;
        out.count = r.total;
        return out;
    }

    private static String buildSummary(Results r) {
        if (r.total == 0) return 'עדיין אין הגשות לטופס זה.';
        List<String> parts = new List<String>{ 'התקבלו ' + r.total + ' הגשות' +
            (r.approved != null ? (', מתוכן ' + r.approved + ' אושרו') : '') +
            (r.needsInfo != null && r.needsInfo > 0 ? (' ו-' + r.needsInfo + ' ממתינות להשלמה') : '') + '.' };
        for (FieldResult fr : r.fields) {
            if (fr.isBar == true && fr.buckets != null && !fr.buckets.isEmpty()) {
                Bucket top = null;
                for (Bucket b : fr.buckets) { if (top == null || b.count > top.count) top = b; }
                if (top != null) parts.add('בשדה "' + fr.label + '" הבחירה הנפוצה: "' + top.label + '" (' + top.percent + '%).');
            } else if (fr.isStat == true && fr.avg != null) {
                parts.add('ממוצע "' + fr.label + '": ' + fr.avg + ' (טווח ' + fr.minV + '–' + fr.maxV + ').');
            }
        }
        return String.join(parts, ' ');
    }

    private static String aggregationText(Results r) {
        List<String> lines = new List<String>();
        for (FieldResult fr : r.fields) {
            if (fr.isBar == true && fr.buckets != null) {
                List<String> bs = new List<String>();
                for (Bucket b : fr.buckets) bs.add(b.label + '=' + b.count);
                lines.add('- ' + fr.label + ': ' + String.join(bs, ', '));
            } else if (fr.isStat == true && fr.avg != null) {
                lines.add('- ' + fr.label + ': ממוצע ' + fr.avg + ', מינ ' + fr.minV + ', מקס ' + fr.maxV);
            } else {
                lines.add('- ' + fr.label + ': מולא ב-' + fr.filled + ' הגשות');
            }
        }
        return String.join(lines, '\n');
    }
}
