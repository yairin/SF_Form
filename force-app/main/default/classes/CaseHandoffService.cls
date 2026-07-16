/**
 * Hands a prepared Form Response off to the municipal service desk by opening a
 * Case. The Form_Response__c is the internal preparation/enrichment record (answer
 * validation, AI review, rounds with the applicant to fix/complete). Once ready, a
 * staff member hands it off — this creates a Case (the existing call-center process)
 * and links the two records both ways. Idempotent: a response already linked to a
 * Case returns that Case instead of creating a duplicate.
 *
 * with sharing + WITH USER_MODE / as user: the handoff runs as the internal user
 * and respects their CRUD/FLS (secure-dev directive 5.35).
 */
public with sharing class CaseHandoffService {

    public class HandoffResult {
        @AuraEnabled public Id caseId;
        @AuraEnabled public String caseNumber;
        @AuraEnabled public Boolean created; // false if it already existed
    }

    @AuraEnabled
    public static HandoffResult createCaseFromResponse(Id responseId) {
        Form_Response__c r = [
            SELECT Id, Subject__c, Form_Name__c, Respondent_Name__c, Email__c, Phone__c,
                   Response_Data__c, Case__c
            FROM Form_Response__c
            WHERE Id = :responseId
            WITH USER_MODE
            LIMIT 1
        ];

        HandoffResult out = new HandoffResult();

        if (r.Case__c != null) {
            out.caseId = r.Case__c;
            out.created = false;
            out.caseNumber = caseNumber(r.Case__c);
            return out;
        }

        Case c = new Case(
            Subject = String.isNotBlank(r.Subject__c) ? r.Subject__c : r.Form_Name__c,
            Status = 'New',
            SuppliedName = r.Respondent_Name__c,
            SuppliedEmail = r.Email__c,
            SuppliedPhone = r.Phone__c,
            Description = buildDescription(r),
            Form_Response__c = r.Id
        );
        insert as user c;

        r.Case__c = c.Id;
        update as user r;

        out.caseId = c.Id;
        out.created = true;
        out.caseNumber = caseNumber(c.Id);
        return out;
    }

    private static String caseNumber(Id caseId) {
        List<Case> cs = [SELECT CaseNumber FROM Case WHERE Id = :caseId WITH USER_MODE LIMIT 1];
        return cs.isEmpty() ? null : cs[0].CaseNumber;
    }

    private static String buildDescription(Form_Response__c r) {
        List<String> lines = new List<String>();
        lines.add('נפתח מטופס דיגיטלי: ' + (r.Form_Name__c == null ? '' : r.Form_Name__c));
        if (String.isNotBlank(r.Respondent_Name__c)) lines.add('שם הפונה: ' + r.Respondent_Name__c);
        try {
            Object parsed = JSON.deserializeUntyped(r.Response_Data__c);
            if (parsed instanceof Map<String, Object>) {
                lines.add('---');
                for (String k : ((Map<String, Object>) parsed).keySet()) {
                    Object v = ((Map<String, Object>) parsed).get(k);
                    lines.add(k + ': ' + (v == null ? '' : String.valueOf(v)));
                }
            }
        } catch (Exception e) {
            // free-text fallback when the payload isn't a JSON object
            if (String.isNotBlank(r.Response_Data__c)) lines.add(r.Response_Data__c);
        }
        String body = String.join(lines, '\n');
        return body.length() > 31900 ? body.substring(0, 31900) : body;
    }
}
