/**
 * Read-only access to a Form Template for rendering (including by Experience
 * Cloud Guest users). without sharing so a Guest can read the definition
 * without a record-sharing rule; only non-sensitive schema data is returned.
 */
public without sharing class FormRenderController {

    @AuraEnabled(cacheable=true)
    public static Form_Template__c getForm(String externalId) {
        List<Form_Template__c> templates = [
            SELECT Id, Name, Description__c, Schema_JSON__c, External_Id__c, Appearance_JSON__c
            FROM Form_Template__c
            WHERE External_Id__c = :externalId AND Active__c = true
            LIMIT 1
        ];
        if (templates.isEmpty()) {
            throw new AuraHandledException('Form not found: ' + externalId);
        }
        return templates[0];
    }
}
