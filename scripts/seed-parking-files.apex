/**
 * שתילת קבצים ממשיים על רשומות "בקשה להקצאת חניה לנכה" (לצורך הדגמת הורדה/צפייה).
 * מצרף לכל אחת מ-8 הרשומות הראשונות 4 מסמכי דמו. ניתן להריץ שוב — מוחק תחילה קבצי דמו קודמים.
 */
String EXT = 'disabled-parking';
Integer HOW_MANY_RECORDS = 20;

List<Form_Response__c> resps = [
    SELECT Id, Name, Respondent_Name__c
    FROM Form_Response__c WHERE Form_External_Id__c = :EXT
    ORDER BY Submitted_At__c DESC NULLS LAST
    LIMIT :HOW_MANY_RECORDS
];
if (resps.isEmpty()) { System.debug('אין רשומות לטופס ' + EXT); return; }

Set<Id> respIds = new Map<Id, Form_Response__c>(resps).keySet();

// ניקוי קבצי דמו קודמים (מזוהים לפי קידומת בכותרת)
Set<Id> existingDocIds = new Set<Id>();
for (ContentDocumentLink l : [SELECT ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId IN :respIds]) {
    existingDocIds.add(l.ContentDocumentId);
}
if (!existingDocIds.isEmpty()) {
    List<ContentDocument> demoDocs = [SELECT Id FROM ContentDocument WHERE Id IN :existingDocIds AND Title LIKE 'דמו · %'];
    if (!demoDocs.isEmpty()) delete demoDocs;
}

// סוגי מסמכים לדוגמה
List<Map<String, String>> docs = new List<Map<String, String>>{
    new Map<String, String>{ 'title' => 'צילום תעודת זהות', 'file' => 'id-card.txt' },
    new Map<String, String>{ 'title' => 'תג נכה', 'file' => 'disabled-tag.txt' },
    new Map<String, String>{ 'title' => 'חוות דעת רפואית', 'file' => 'medical-opinion.txt' },
    new Map<String, String>{ 'title' => 'אישור רשמי', 'file' => 'official-approval.txt' }
};

List<ContentVersion> cvs = new List<ContentVersion>();
// מפה לשחזור השיוך: אינדקס ContentVersion -> responseId
List<Id> ownerByIndex = new List<Id>();
for (Form_Response__c r : resps) {
    for (Map<String, String> d : docs) {
        String body = 'מסמך דמו — ' + d.get('title') + '\n'
            + 'פונה: ' + r.Respondent_Name__c + '\n'
            + 'סימוכין: ' + r.Name + '\n\n'
            + 'זהו קובץ הדגמה שנוצר להמחשת חוויית ההעלאה וההורדה במערכת הטפסים. '
            + 'בהגשה אמיתית כאן יופיע המסמך שהעלה הפונה (' + d.get('title') + ').';
        ContentVersion cv = new ContentVersion();
        cv.Title = 'דמו · ' + d.get('title') + ' — ' + r.Name;
        cv.PathOnClient = d.get('file');
        cv.VersionData = Blob.valueOf(body);
        cvs.add(cv);
        ownerByIndex.add(r.Id);
    }
}
insert cvs;

// שליפת ContentDocumentId עבור כל ContentVersion, ויצירת קישורים לרשומות
Map<Id, Id> cvToDoc = new Map<Id, Id>();
for (ContentVersion cv : [SELECT Id, ContentDocumentId FROM ContentVersion WHERE Id IN :cvs]) {
    cvToDoc.put(cv.Id, cv.ContentDocumentId);
}
List<ContentDocumentLink> links = new List<ContentDocumentLink>();
for (Integer i = 0; i < cvs.size(); i++) {
    Id docId = cvToDoc.get(cvs[i].Id);
    if (docId == null) continue;
    links.add(new ContentDocumentLink(
        ContentDocumentId = docId,
        LinkedEntityId = ownerByIndex[i],
        ShareType = 'V',
        Visibility = 'AllUsers'
    ));
}
insert links;

System.debug('נשתלו ' + cvs.size() + ' קבצים על ' + resps.size() + ' רשומות (' + docs.size() + ' לכל רשומה).');
