/**
 * Admin-facing CRUD for form templates (used by the formBuilder + formManager LWCs).
 * with sharing — only authorized internal users build forms.
 */
public with sharing class FormBuilderController {

    /** Row shape for the management list: template + response count + public URL. */
    public class TemplateInfo {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String externalId;
        @AuraEnabled public Boolean active;
        @AuraEnabled public String description;
        @AuraEnabled public String serviceType;
        @AuraEnabled public Integer responseCount;
        @AuraEnabled public String url;
    }

    @AuraEnabled(cacheable=true)
    public static List<Form_Template__c> listForms() {
        return [
            SELECT Id, Name, External_Id__c, Active__c, Description__c
            FROM Form_Template__c
            ORDER BY CreatedDate DESC
        ];
    }

    /** Richer list for the "Forms" management tab: adds service type, submission count, public URL. */
    // Not cacheable: submission counts must be live so newly seeded/submitted
    // responses show up without a hard refresh.
    @AuraEnabled
    public static List<TemplateInfo> listFormsDetailed() {
        Map<String, Integer> counts = new Map<String, Integer>();
        for (AggregateResult ar : [
            SELECT Form_External_Id__c ext, COUNT(Id) c
            FROM Form_Response__c
            WHERE Form_External_Id__c != null
            GROUP BY Form_External_Id__c
        ]) {
            counts.put((String) ar.get('ext'), (Integer) ar.get('c'));
        }
        List<TemplateInfo> out = new List<TemplateInfo>();
        for (Form_Template__c t : [
            SELECT Id, Name, External_Id__c, Active__c, Description__c, Service_Type__r.Name
            FROM Form_Template__c
            ORDER BY CreatedDate DESC
        ]) {
            TemplateInfo ti = new TemplateInfo();
            ti.id = t.Id;
            ti.name = t.Name;
            ti.externalId = t.External_Id__c;
            ti.active = t.Active__c;
            ti.description = t.Description__c;
            ti.serviceType = t.Service_Type__r.Name;
            ti.responseCount = counts.containsKey(t.External_Id__c) ? counts.get(t.External_Id__c) : 0;
            ti.url = buildUrl(t.External_Id__c);
            out.add(ti);
        }
        return out;
    }

    @AuraEnabled(cacheable=true)
    public static List<Service_Type__c> listServiceTypes() {
        return [SELECT Id, Name FROM Service_Type__c WHERE Active__c = true ORDER BY Name];
    }

    /** Full template for editing in the builder. */
    @AuraEnabled(cacheable=true)
    public static Form_Template__c getTemplate(Id recordId) {
        return [
            SELECT Id, Name, Description__c, Schema_JSON__c, External_Id__c, Active__c, Service_Type__c,
                   AI_Review_Enabled__c, AI_Review_Instructions__c,
                   AI_Check_Attachments__c, AI_Contact_Applicant__c
            FROM Form_Template__c
            WHERE Id = :recordId
            LIMIT 1
        ];
    }

    /** Save the AI-review expectations defined by the form creator. */
    @AuraEnabled
    public static void setAIConfig(Id recordId, Boolean enabled, String instructions,
                                   Boolean checkAttachments, Boolean contactApplicant) {
        Form_Template__c f = [SELECT Id FROM Form_Template__c WHERE Id = :recordId LIMIT 1];
        f.AI_Review_Enabled__c = enabled == true;
        f.AI_Review_Instructions__c = instructions;
        f.AI_Check_Attachments__c = checkAttachments == true;
        f.AI_Contact_Applicant__c = contactApplicant == true;
        update f;
    }

    @AuraEnabled
    public static Form_Template__c saveForm(String recordId, String title, String description, String schemaJson, String externalId, String serviceTypeId) {
        Form_Template__c f;
        if (String.isNotBlank(recordId)) {
            f = [SELECT Id, External_Id__c FROM Form_Template__c WHERE Id = :recordId LIMIT 1];
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

    /** Activate / deactivate a form (deactivated forms stop rendering for the public). */
    @AuraEnabled
    public static void setActive(Id recordId, Boolean active) {
        Form_Template__c f = [SELECT Id FROM Form_Template__c WHERE Id = :recordId LIMIT 1];
        f.Active__c = active;
        update f;
    }

    /** Duplicate a form. The copy starts inactive with a fresh external id so it never collides. */
    @AuraEnabled
    public static Form_Template__c cloneForm(Id recordId) {
        Form_Template__c src = [
            SELECT Name, Description__c, Schema_JSON__c, External_Id__c, Service_Type__c
            FROM Form_Template__c
            WHERE Id = :recordId
            LIMIT 1
        ];
        String base = String.isBlank(src.External_Id__c) ? 'form' : src.External_Id__c;
        Form_Template__c copy = new Form_Template__c(
            Name           = src.Name + ' (עותק)',
            Description__c  = src.Description__c,
            Schema_JSON__c  = src.Schema_JSON__c,
            Service_Type__c = src.Service_Type__c,
            External_Id__c  = base + '-copy-' + String.valueOf(Datetime.now().getTime()),
            Active__c       = false
        );
        insert copy;
        return copy;
    }

    @AuraEnabled
    public static void deleteForm(Id recordId) {
        delete [SELECT Id FROM Form_Template__c WHERE Id = :recordId LIMIT 1];
    }

    /** Public (Experience Cloud) URL for a given form external id, or null if not configured. */
    @AuraEnabled(cacheable=true)
    public static String getPublicUrl(String externalId) {
        return buildUrl(externalId);
    }

    private static String buildUrl(String externalId) {
        if (String.isBlank(externalId)) return null;
        String base = System.Label.Form_Public_Site_Base_Url;
        if (String.isBlank(base)) return null;
        String sep = base.contains('?') ? '&' : '?';
        return base + sep + 'formId=' + EncodingUtil.urlEncode(externalId, 'UTF-8');
    }
}
