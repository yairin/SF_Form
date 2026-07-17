/**
 * Routes a new Form Response to the department that owns its form's Service Type
 * and sets the SLA due date. Runs from the after-insert trigger (system context).
 * MVP SLA = now + Default_SLA_Hours (calendar hours); business-hours SLA is a
 * planned enhancement (see docs/PRD.md).
 */
public without sharing class FormRoutingService {

    public static void route(List<Form_Response__c> responses) {
        Set<String> extIds = new Set<String>();
        for (Form_Response__c r : responses) {
            if (String.isNotBlank(r.Form_External_Id__c)) extIds.add(r.Form_External_Id__c);
        }
        if (extIds.isEmpty()) return;

        Map<String, Form_Template__c> byExt = new Map<String, Form_Template__c>();
        Set<String> codesToResolve = new Set<String>();
        for (Form_Template__c t : [
            SELECT External_Id__c, Authority__c, Authority__r.Code__c, Authority_Code__c, Service_Type__c,
                   Service_Type__r.Department__c, Service_Type__r.Default_SLA_Hours__c
            FROM Form_Template__c
            WHERE External_Id__c IN :extIds
        ]) {
            byExt.put(t.External_Id__c, t);
            // A template built in the LWC carries only the flat Authority_Code__c (stamped from
            // the creating user), not the Authority__c lookup. Collect those codes so we can
            // resolve them to Authority records below.
            if (t.Authority__c == null && String.isNotBlank(t.Authority_Code__c)) {
                codesToResolve.add(t.Authority_Code__c);
            }
        }

        Map<String, Id> authorityByCode = new Map<String, Id>();
        if (!codesToResolve.isEmpty()) {
            for (Authority__c a : [SELECT Id, Code__c FROM Authority__c WHERE Code__c IN :codesToResolve]) {
                authorityByCode.put(a.Code__c, a.Id);
            }
        }

        List<Form_Response__c> updates = new List<Form_Response__c>();
        for (Form_Response__c r : responses) {
            Form_Template__c t = byExt.get(r.Form_External_Id__c);
            if (t == null) continue;
            Form_Response__c u = new Form_Response__c(Id = r.Id);
            Boolean changed = false;
            // Stamp the tenant (authority) so multi-authority isolation applies. The response's
            // Authority_Code__c is a formula off Authority__r.Code__c (read-only), so we set the
            // writeable Authority__c lookup and let the formula derive the isolation key.
            Id authId = t.Authority__c;
            String authCode = t.Authority__r.Code__c;
            if (authId == null && String.isNotBlank(t.Authority_Code__c)
                    && authorityByCode.containsKey(t.Authority_Code__c)) {
                authId = authorityByCode.get(t.Authority_Code__c);
                authCode = t.Authority_Code__c;
            }
            if (authId != null) {
                u.Authority__c = authId;
                u.Tenant_Code__c = authCode;
                changed = true;
            }
            if (t.Service_Type__c != null) {
                u.Service_Type__c = t.Service_Type__c;
                u.Department__c = t.Service_Type__r.Department__c;
                Decimal hrs = t.Service_Type__r.Default_SLA_Hours__c;
                if (hrs != null) {
                    u.SLA_Due__c = System.now().addMinutes((Integer) (hrs * 60));
                }
                changed = true;
            }
            if (changed) updates.add(u);
        }
        if (!updates.isEmpty()) update updates;
    }
}
