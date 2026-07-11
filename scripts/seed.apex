// Idempotent reference data so routing has departments/service types and the
// builder's Service Type picker has options.
if ([SELECT COUNT() FROM Department__c] == 0) {
    Department__c culture = new Department__c(Name = 'תרבות', Email__c = 'culture@example.gov.il');
    Department__c licensing = new Department__c(Name = 'רישוי', Email__c = 'licensing@example.gov.il');
    insert new List<Department__c>{ culture, licensing };
    insert new List<Service_Type__c>{
        new Service_Type__c(Name = 'רישום לאירוע', Department__c = culture.Id, Default_SLA_Hours__c = 48),
        new Service_Type__c(Name = 'בקשה כללית', Department__c = licensing.Id, Default_SLA_Hours__c = 72)
    };
    System.debug('SEED created departments + service types');
} else {
    System.debug('SEED skipped departments (data already exists)');
}

// Idempotent public form template so the Experience Cloud Guest page has a real,
// active, routable form to render (dynamicForm externalId = 'event-registration').
// Linked to the 'רישום לאירוע' service type so submissions route to תרבות with a 48h SLA.
if ([SELECT COUNT() FROM Form_Template__c WHERE External_Id__c = 'event-registration'] == 0) {
    List<Service_Type__c> st = [SELECT Id FROM Service_Type__c WHERE Name = 'רישום לאירוע' LIMIT 1];
    String schema = '['
        + '{"key":"fullName","label":"שם מלא","type":"text","required":true,"mapTo":"respondentName"},'
        + '{"key":"email","label":"אימייל","type":"email","required":true,"mapTo":"email"},'
        + '{"key":"phone","label":"טלפון","type":"phone","mapTo":"phone"},'
        + '{"key":"participants","label":"מספר משתתפים","type":"number"},'
        + '{"key":"transport","label":"נדרשת הסעה?","type":"radio","options":["כן","לא"]},'
        + '{"key":"notes","label":"הערות נוספות","type":"textarea"}'
        + ']';
    Form_Template__c tpl = new Form_Template__c(
        Name            = 'טופס רישום לאירוע',
        External_Id__c  = 'event-registration',
        Active__c       = true,
        Description__c  = 'טופס ציבורי אנונימי לרישום לאירוע — נשלח דרך Experience Cloud.',
        Schema_JSON__c  = schema
    );
    if (!st.isEmpty()) {
        tpl.Service_Type__c = st[0].Id;
    }
    insert tpl;
    System.debug('SEED created public form template event-registration');
} else {
    System.debug('SEED skipped public template (already exists)');
}
