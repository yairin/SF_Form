// מוציא את כל תבניות הטפסים + ספירת תגובות לכל טופס, לצורך זיהוי הטופס הנכון.
Map<String,Integer> counts = new Map<String,Integer>();
for (AggregateResult ar : [
    SELECT Form_External_Id__c ext, COUNT(Id) c
    FROM Form_Response__c GROUP BY Form_External_Id__c
]) {
    counts.put((String) ar.get('ext'), (Integer) ar.get('c'));
}
for (Form_Template__c t : [
    SELECT Name, External_Id__c, Active__c, AI_Review_Enabled__c
    FROM Form_Template__c ORDER BY Name
]) {
    Integer c = counts.containsKey(t.External_Id__c) ? counts.get(t.External_Id__c) : 0;
    System.debug('FORM|' + t.Name + '|ext=' + t.External_Id__c
        + '|active=' + t.Active__c + '|ai=' + t.AI_Review_Enabled__c + '|responses=' + c);
}
