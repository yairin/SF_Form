// Phase A provisioning + backfill for multi-authority isolation.
// Idempotent: creates the demo authority, assigns blank users to it, and stamps
// existing templates/responses with the demo code. Safe to re-run.
final String DEMO_CODE = '0000';
final String DEMO_NAME = 'MuniForceCity';

// 1. Demo authority record
List<Authority__c> existing = [SELECT Id FROM Authority__c WHERE Code__c = :DEMO_CODE LIMIT 1];
if (existing.isEmpty()) {
    insert new Authority__c(Name = DEMO_NAME, Code__c = DEMO_CODE, Active__c = true);
    System.debug('BACKFILL|created demo authority ' + DEMO_CODE + ' / ' + DEMO_NAME);
} else {
    System.debug('BACKFILL|demo authority already exists');
}

// 2. Assign internal users without an authority code to the demo authority
List<User> users = [
    SELECT Id FROM User
    WHERE IsActive = true AND UserType = 'Standard' AND Authority_Code__c = null
];
for (User u : users) u.Authority_Code__c = DEMO_CODE;
if (!users.isEmpty()) { update users; }
System.debug('BACKFILL|users stamped=' + users.size());

// 3. Backfill templates
List<Form_Template__c> tpls = [SELECT Id FROM Form_Template__c WHERE Authority_Code__c = null];
for (Form_Template__c t : tpls) t.Authority_Code__c = DEMO_CODE;
if (!tpls.isEmpty()) { update tpls; }
System.debug('BACKFILL|templates stamped=' + tpls.size());

// 4. Backfill responses
List<Form_Response__c> resp = [SELECT Id FROM Form_Response__c WHERE Authority_Code__c = null];
for (Form_Response__c r : resp) r.Authority_Code__c = DEMO_CODE;
if (!resp.isEmpty()) { update resp; }
System.debug('BACKFILL|responses stamped=' + resp.size());

System.debug('BACKFILL|done');
