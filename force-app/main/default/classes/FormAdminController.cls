/**
 * Admin management: define service types (routing targets + SLA) and read
 * departments for the picker. General AI settings live in FormSettingsController.
 */
public with sharing class FormAdminController {

    public class ServiceTypeInfo {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public Id departmentId;
        @AuraEnabled public String department;
        @AuraEnabled public Decimal slaHours;
        @AuraEnabled public Boolean active;
        @AuraEnabled public String activeLabel;
    }

    @AuraEnabled(cacheable=true)
    public static List<ServiceTypeInfo> getServiceTypes() {
        List<ServiceTypeInfo> out = new List<ServiceTypeInfo>();
        for (Service_Type__c s : [
            SELECT Id, Name, Department__c, Department__r.Name, Default_SLA_Hours__c, Active__c
            FROM Service_Type__c WITH USER_MODE ORDER BY Name
        ]) {
            ServiceTypeInfo i = new ServiceTypeInfo();
            i.id = s.Id;
            i.name = s.Name;
            i.departmentId = s.Department__c;
            i.department = s.Department__r.Name;
            i.slaHours = s.Default_SLA_Hours__c;
            i.active = s.Active__c;
            i.activeLabel = s.Active__c ? 'פעיל' : 'לא פעיל';
            out.add(i);
        }
        return out;
    }

    @AuraEnabled(cacheable=true)
    public static List<Department__c> getDepartments() {
        return [SELECT Id, Name FROM Department__c WHERE Active__c = true WITH USER_MODE ORDER BY Name];
    }

    @AuraEnabled
    public static Id saveServiceType(Id recordId, String name, Id departmentId, Decimal slaHours, Boolean active) {
        Service_Type__c s = (recordId == null)
            ? new Service_Type__c()
            : [SELECT Id FROM Service_Type__c WHERE Id = :recordId WITH USER_MODE LIMIT 1];
        s.Name = name;
        s.Department__c = departmentId;
        s.Default_SLA_Hours__c = slaHours;
        s.Active__c = active == null ? true : active;
        upsert as user s;
        return s.Id;
    }

    @AuraEnabled
    public static void setServiceTypeActive(Id recordId, Boolean active) {
        Service_Type__c s = [SELECT Id FROM Service_Type__c WHERE Id = :recordId WITH USER_MODE LIMIT 1];
        s.Active__c = active;
        update as user s;
    }
}
