// אבחון נראות: מי המשתמש הנוכחי, מה ה-Authority Code שלו, והאם הוא עוקף כללי הגבלה,
// מול הסימון (Tenant_Code) של פניות disabled-parking.
User u = [SELECT Id, Name, Username, Profile.Name, Authority_Code__c FROM User WHERE Id = :UserInfo.getUserId()];
System.debug('USER|' + u.Name + '|' + u.Username + '|profile=' + u.Profile.Name + '|authorityCode=[' + u.Authority_Code__c + ']');

Boolean viewAll = FeatureManagement.checkPermission('ViewAllData'); // may be null-safe
System.debug('PERM|ViewAllData(feature)=' + viewAll);
for (PermissionSetAssignment psa : [
    SELECT PermissionSet.Name, PermissionSet.PermissionsViewAllData, PermissionSet.PermissionsModifyAllData
    FROM PermissionSetAssignment WHERE AssigneeId = :UserInfo.getUserId()
]) {
    if (psa.PermissionSet.PermissionsViewAllData || psa.PermissionSet.PermissionsModifyAllData)
        System.debug('PERMSET|' + psa.PermissionSet.Name + '|viewAll=' + psa.PermissionSet.PermissionsViewAllData
            + '|modAll=' + psa.PermissionSet.PermissionsModifyAllData);
}

// ספירה לפי Tenant_Code (רץ כ-without sharing כדי לראות הכול)
System.debug('--- responses for disabled-parking, by Tenant_Code ---');
for (AggregateResult ar : [
    SELECT Tenant_Code__c tc, COUNT(Id) c FROM Form_Response__c
    WHERE Form_External_Id__c = 'disabled-parking' GROUP BY Tenant_Code__c
]) {
    System.debug('TENANT|[' + ar.get('tc') + ']|count=' + ar.get('c'));
}
