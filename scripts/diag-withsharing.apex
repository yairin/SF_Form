// משחזר בדיוק את מסלול האפליקציה: שאילתה תחת with sharing (אכיפת שיתוף + כללי הגבלה)
// עבור המשתמש הרץ. אם מחזיר 20 → הבעיה היא cache בצד הלקוח. אם 0 → כלל הגבלה חוסם.
public with sharing class Probe {
    public Integer countShared() {
        return [SELECT COUNT() FROM Form_Response__c WHERE Form_External_Id__c = 'disabled-parking'];
    }
}
Integer shared = new Probe().countShared();
Integer systemCount = [SELECT COUNT() FROM Form_Response__c WHERE Form_External_Id__c = 'disabled-parking'];
System.debug('COUNTS|withSharing=' + shared + '|systemMode=' + systemCount);
