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

    // ---- record-level drill-down ----
    public class ResponseRow {
        @AuraEnabled public Id id;
        @AuraEnabled public String reference;
        @AuraEnabled public String respondentName;
        @AuraEnabled public Datetime submittedAt;
        @AuraEnabled public String aiStatus;
        @AuraEnabled public String aiStatusLabel;
    }
    public class FieldValue {
        @AuraEnabled public String label;
        @AuraEnabled public String value;
    }
    public class FileRef {
        @AuraEnabled public String title;
        @AuraEnabled public String fileType;
        @AuraEnabled public Id contentDocumentId;
        @AuraEnabled public String downloadUrl;
    }
    public class InteractionRow {
        @AuraEnabled public String direction;
        @AuraEnabled public String interactionType;
        @AuraEnabled public String message;
        @AuraEnabled public Datetime occurredAt;
    }
    public class ResponseDetail {
        @AuraEnabled public Id id;
        @AuraEnabled public String reference;
        @AuraEnabled public String respondentName;
        @AuraEnabled public String email;
        @AuraEnabled public String phone;
        @AuraEnabled public Datetime submittedAt;
        @AuraEnabled public String aiStatus;
        @AuraEnabled public String aiStatusLabel;
        @AuraEnabled public String aiFindings;
        @AuraEnabled public Datetime aiReviewedAt;
        @AuraEnabled public Boolean updateRequested;
        @AuraEnabled public List<FieldValue> fields;
        @AuraEnabled public List<FileRef> files;
        @AuraEnabled public List<InteractionRow> interactions;
    }

    private static final Map<String, String> AI_LABELS = new Map<String, String>{
        'Approved' => 'אושר', 'Needs_Info' => 'נדרשת השלמה', 'Pending' => 'ממתין', 'Error' => 'שגיאה'
    };
    private static final Map<String, String> DIR_LABELS = new Map<String, String>{
        'To_Applicant' => 'לפונה', 'From_Applicant' => 'מהפונה', 'System' => 'מערכת'
    };
    private static final Map<String, String> ITYPE_LABELS = new Map<String, String>{
        'AI_Review' => 'בדיקת AI', 'Info_Request' => 'בקשת השלמה', 'Applicant_Reply' => 'תשובת פונה',
        'Re_Review' => 'בדיקה חוזרת', 'Approval' => 'אישור/העברה לעובד', 'Note' => 'הערה'
    };
    private static String lbl(Map<String, String> m, String v) {
        if (v == null) return '';
        return m.containsKey(v) ? m.get(v) : v;
    }

    /** Individual submissions of a form, for the record-level list. */
    @AuraEnabled
    public static List<ResponseRow> listResponses(String externalId) {
        List<ResponseRow> out = new List<ResponseRow>();
        for (Form_Response__c r : [
            SELECT Id, Name, Respondent_Name__c, Submitted_At__c, AI_Status__c
            FROM Form_Response__c
            WHERE Form_External_Id__c = :externalId
            ORDER BY Submitted_At__c DESC NULLS LAST, CreatedDate DESC
            LIMIT 2000
        ]) {
            ResponseRow row = new ResponseRow();
            row.id = r.Id;
            row.reference = r.Name;
            row.respondentName = r.Respondent_Name__c;
            row.submittedAt = r.Submitted_At__c;
            row.aiStatus = r.AI_Status__c;
            row.aiStatusLabel = r.AI_Status__c == null ? 'לא נבדק' : lbl(AI_LABELS, r.AI_Status__c);
            out.add(row);
        }
        return out;
    }

    /** Full detail for one submission: field values, uploaded files, and the AI interaction thread. */
    @AuraEnabled
    public static ResponseDetail getResponseDetail(Id responseId) {
        Form_Response__c r = [
            SELECT Id, Name, Form_External_Id__c, Respondent_Name__c, Email__c, Phone__c,
                   Submitted_At__c, Response_Data__c, AI_Status__c, AI_Findings__c,
                   AI_Reviewed_At__c, Update_Requested__c
            FROM Form_Response__c WHERE Id = :responseId LIMIT 1
        ];
        ResponseDetail d = new ResponseDetail();
        d.id = r.Id;
        d.reference = r.Name;
        d.respondentName = r.Respondent_Name__c;
        d.email = r.Email__c;
        d.phone = r.Phone__c;
        d.submittedAt = r.Submitted_At__c;
        d.aiStatus = r.AI_Status__c;
        d.aiStatusLabel = r.AI_Status__c == null ? 'לא נבדק' : lbl(AI_LABELS, r.AI_Status__c);
        d.aiFindings = r.AI_Findings__c;
        d.aiReviewedAt = r.AI_Reviewed_At__c;
        d.updateRequested = r.Update_Requested__c == true;
        d.fields = new List<FieldValue>();
        d.files = new List<FileRef>();
        d.interactions = new List<InteractionRow>();

        Map<String, Object> data;
        try { data = (Map<String, Object>) JSON.deserializeUntyped(r.Response_Data__c); }
        catch (Exception e) { data = new Map<String, Object>(); }

        List<Form_Template__c> tpls = [
            SELECT Schema_JSON__c FROM Form_Template__c WHERE External_Id__c = :r.Form_External_Id__c LIMIT 1
        ];
        if (!tpls.isEmpty()) {
            for (Object fo : FormValidationService.flattenFields(tpls[0].Schema_JSON__c)) {
                if (!(fo instanceof Map<String, Object>)) continue;
                Map<String, Object> f = (Map<String, Object>) fo;
                String key = (String) f.get('key');
                if (key == null || !data.containsKey(key)) continue;
                Object v = data.get(key);
                String sv = v == null ? '' : String.valueOf(v);
                if (String.isBlank(sv)) continue;
                FieldValue fv = new FieldValue();
                fv.label = f.get('label') == null ? key : (String) f.get('label');
                fv.value = sv;
                d.fields.add(fv);
            }
        }
        if (d.fields.isEmpty()) {
            for (String k : data.keySet()) {
                Object v = data.get(k);
                if (v == null || String.isBlank(String.valueOf(v))) continue;
                FieldValue fv = new FieldValue();
                fv.label = k;
                fv.value = String.valueOf(v);
                d.fields.add(fv);
            }
        }

        Set<Id> docIds = new Set<Id>();
        for (ContentDocumentLink l : [
            SELECT ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = :responseId
        ]) {
            docIds.add(l.ContentDocumentId);
        }
        if (!docIds.isEmpty()) {
            for (ContentVersion cv : [
                SELECT ContentDocumentId, Title, FileType FROM ContentVersion
                WHERE ContentDocumentId IN :docIds AND IsLatest = true
            ]) {
                FileRef fr = new FileRef();
                fr.title = cv.Title;
                fr.fileType = cv.FileType;
                fr.contentDocumentId = cv.ContentDocumentId;
                fr.downloadUrl = '/sfc/servlet.shepherd/document/download/' + cv.ContentDocumentId;
                d.files.add(fr);
            }
        }

        for (Form_Interaction__c i : [
            SELECT Direction__c, Interaction_Type__c, Message__c, Occurred_At__c
            FROM Form_Interaction__c WHERE Form_Response__c = :responseId
            ORDER BY Occurred_At__c ASC NULLS FIRST
        ]) {
            InteractionRow ir = new InteractionRow();
            ir.direction = lbl(DIR_LABELS, i.Direction__c);
            ir.interactionType = lbl(ITYPE_LABELS, i.Interaction_Type__c);
            ir.message = i.Message__c;
            ir.occurredAt = i.Occurred_At__c;
            d.interactions.add(ir);
        }
        return d;
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
