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
        for (Form_Template__c t : [
            SELECT External_Id__c, Service_Type__c,
                   Service_Type__r.Department__c, Service_Type__r.Default_SLA_Hours__c
            FROM Form_Template__c
            WHERE External_Id__c IN :extIds
        ]) {
            byExt.put(t.External_Id__c, t);
        }

        List<Form_Response__c> updates = new List<Form_Response__c>();
        for (Form_Response__c r : responses) {
            Form_Template__c t = byExt.get(r.Form_External_Id__c);
            if (t == null || t.Service_Type__c == null) continue;
            Form_Response__c u = new Form_Response__c(Id = r.Id);
            u.Service_Type__c = t.Service_Type__c;
            u.Department__c = t.Service_Type__r.Department__c;
            Decimal hrs = t.Service_Type__r.Default_SLA_Hours__c;
            if (hrs != null) {
                u.SLA_Due__c = System.now().addMinutes((Integer) (hrs * 60));
            }
            updates.add(u);
        }
        if (!updates.isEmpty()) update updates;
    }
}
