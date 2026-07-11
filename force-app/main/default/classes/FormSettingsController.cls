/**
 * Reads/writes the org-default SF Forms AI settings (Form_AI_Setting__c hierarchy
 * custom setting). The API key is never returned to the client — only a flag
 * indicating whether one is stored.
 */
public with sharing class FormSettingsController {

    public class Settings {
        @AuraEnabled public String engine;
        @AuraEnabled public String endpoint;
        @AuraEnabled public String model;
        @AuraEnabled public Boolean hasApiKey;
    }

    // Not cacheable: the settings screen must reflect a save immediately (no stale
    // client cache showing the previous engine after the user switches it).
    @AuraEnabled
    public static Settings getSettings() {
        Form_AI_Setting__c s = Form_AI_Setting__c.getOrgDefaults();
        Settings out = new Settings();
        out.engine = (s != null && String.isNotBlank(s.Engine__c)) ? s.Engine__c : 'Agentforce';
        out.endpoint = (s == null) ? null : s.LLM_Endpoint__c;
        out.model = (s == null) ? null : s.LLM_Model__c;
        out.hasApiKey = (s != null && String.isNotBlank(s.LLM_API_Key__c));
        return out;
    }

    @AuraEnabled
    public static void saveSettings(String engine, String endpoint, String model, String apiKey) {
        Form_AI_Setting__c s = Form_AI_Setting__c.getOrgDefaults();
        if (s == null || s.Id == null) {
            s = new Form_AI_Setting__c(SetupOwnerId = UserInfo.getOrganizationId());
        }
        s.Engine__c = String.isBlank(engine) ? 'Agentforce' : engine;
        s.LLM_Endpoint__c = endpoint;
        s.LLM_Model__c = model;
        // Only overwrite the key when a new one is supplied (blank = keep existing).
        if (String.isNotBlank(apiKey)) {
            s.LLM_API_Key__c = apiKey;
        }
        upsert s;
    }
}
