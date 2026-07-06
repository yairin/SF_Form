/**
 * Native entry point for Lightning/Experience Cloud forms to create a
 * Form_Response__c. Callable from LWC (including Experience Cloud Guest users).
 * Runs without sharing so anonymous Guest submissions can insert regardless of
 * record sharing; object/field access is still governed by the Guest
 * permission set (SF_Forms_Public_Submit).
 */
public without sharing class FormResponseController {

    public class Result {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
    }

    @AuraEnabled
    public static Result submitResponse(
        String formName, String externalId, String payloadJson,
        String respondentName, String email, String phone, String subject
    ) {
        // Authoritative server-side validation against the template schema.
        if (String.isNotBlank(externalId) && externalId != 'preview') {
            List<Form_Template__c> tpls = [
                SELECT Schema_JSON__c FROM Form_Template__c
                WHERE External_Id__c = :externalId AND Active__c = true LIMIT 1
            ];
            if (!tpls.isEmpty()) {
                Map<String, Object> values;
                try {
                    values = (Map<String, Object>) JSON.deserializeUntyped(payloadJson);
                } catch (Exception e) {
                    values = new Map<String, Object>();
                }
                List<String> errs = FormValidationService.validate(tpls[0].Schema_JSON__c, values);
                if (!errs.isEmpty()) {
                    throw new AuraHandledException(String.join(errs, '\n'));
                }
            }
        }

        Form_Response__c r = new Form_Response__c(
            Form_Name__c        = clip(formName, 255),
            Form_External_Id__c = clip(externalId, 255),
            Submitted_At__c     = System.now(),
            Response_Data__c    = payloadJson,
            Respondent_Name__c  = clip(respondentName, 255),
            Email__c            = clip(email, 255),
            Phone__c            = clip(phone, 40),
            Subject__c          = clip(subject, 255),
            Status__c           = 'New'
        );
        insert r;

        Result res = new Result();
        res.id = r.Id;
        res.name = [SELECT Name FROM Form_Response__c WHERE Id = :r.Id].Name;
        return res;
    }

    private static String clip(String v, Integer max) {
        if (v == null) return null;
        return v.length() > max ? v.substring(0, max) : v;
    }
}
