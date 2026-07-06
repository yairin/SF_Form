/**
 * Attaches uploaded files to a Form_Response__c as ContentVersion + ContentDocumentLink.
 * without sharing so anonymous Guest submissions can attach regardless of record
 * sharing. (Guest file creation also requires the org's guest-file setting.)
 */
public without sharing class FormFileService {

    public class FileInput {
        @AuraEnabled public String name;
        @AuraEnabled public String base64;
    }

    @AuraEnabled
    public static void attachFiles(Id responseId, List<FileInput> files) {
        if (responseId == null || files == null || files.isEmpty()) return;

        List<ContentVersion> cvs = new List<ContentVersion>();
        for (FileInput f : files) {
            if (f == null || String.isBlank(f.base64)) continue;
            String fname = String.isBlank(f.name) ? 'attachment' : f.name;
            cvs.add(new ContentVersion(
                Title = fname,
                PathOnClient = fname,
                VersionData = EncodingUtil.base64Decode(f.base64)
            ));
        }
        if (cvs.isEmpty()) return;
        insert cvs;

        Set<Id> cvIds = new Set<Id>();
        for (ContentVersion cv : cvs) cvIds.add(cv.Id);

        List<ContentDocumentLink> links = new List<ContentDocumentLink>();
        for (ContentVersion cv : [SELECT ContentDocumentId FROM ContentVersion WHERE Id IN :cvIds]) {
            links.add(new ContentDocumentLink(
                ContentDocumentId = cv.ContentDocumentId,
                LinkedEntityId = responseId,
                ShareType = 'V',
                Visibility = 'AllUsers'
            ));
        }
        insert links;
    }
}
