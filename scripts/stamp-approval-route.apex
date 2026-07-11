/**
 * עדכון לא-הרסני: משלים את Approval_Route__c על רשומות disabled-parking קיימות
 * לפי disabilityPct (>=90 אישור אוטומטי, אחרת ועדת חריגים). לא מוחק דבר.
 */
List<Form_Response__c> toUpdate = new List<Form_Response__c>();
for (Form_Response__c r : [
    SELECT Id, Response_Data__c, Approval_Route__c
    FROM Form_Response__c WHERE Form_External_Id__c = 'disabled-parking'
]) {
    Decimal pct = null;
    try {
        Object parsed = JSON.deserializeUntyped(r.Response_Data__c);
        if (parsed instanceof Map<String, Object>) {
            Object v = ((Map<String, Object>) parsed).get('disabilityPct');
            if (v != null) pct = Decimal.valueOf(String.valueOf(v).trim());
        }
    } catch (Exception e) { /* skip */ }
    if (pct == null) continue;
    r.Approval_Route__c = (pct >= 90) ? 'Auto_Approve' : 'Exceptions_Committee';
    toUpdate.add(r);
}
update toUpdate;
System.debug('עודכן Approval_Route על ' + toUpdate.size() + ' רשומות.');
