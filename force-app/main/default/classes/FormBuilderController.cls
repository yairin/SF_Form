/**
 * Admin-facing CRUD for form templates (used by the formBuilder LWC).
 * with sharing — only authorized internal users build forms.
 */
public with sharing class FormBuilderController {

    @AuraEnabled(cacheable=true)
    public static List<Form_Template__c> listForms() {
        return [
            SELECT Id, Name, External_Id__c, Active__c, Description__c
            FROM Form_Template__c
            ORDER BY CreatedDate DESC
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Service_Type__c> listServiceTypes() {
        return [SELECT Id, Name FROM Service_Type__c WHERE Active__c = true ORDER BY Name];
    }

    @AuraEnabled
    public static Form_Template__c saveForm(String recordId, String title, String description, String schemaJson, String externalId, String serviceTypeId) {
        Form_Template__c f;
        if (String.isNotBlank(recordId)) {
            f = [SELECT Id FROM Form_Template__c WHERE Id = :recordId LIMIT 1];
        } else {
            f = new Form_Template__c(External_Id__c = externalId);
        }
        f.Name = title;
        f.Description__c = description;
        f.Schema_JSON__c = schemaJson;
        f.Active__c = true;
        f.Service_Type__c = String.isBlank(serviceTypeId) ? null : (Id) serviceTypeId;
        upsert f;
        return f;
    }
}
