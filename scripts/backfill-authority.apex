// Phase A provisioning + backfill for multi-authority isolation.
// Idempotent: creates the demo authority, assigns blank users to it, and stamps
// existing templates/responses with the demo code. Safe to re-run.
final String DEMO_CODE = '0000';
final String DEMO_NAME = 'MuniForceCity';

// 1. Demo authority record
List<Authority__c> existing = [SELECT Id FROM Authority__c WHERE Code__c = :DEMO_CODE LIMIT 1];
Id demoAuthId;
if (existing.isEmpty()) {
    Authority__c demo = new Authority__c(Name = DEMO_NAME, Code__c = DEMO_CODE, Active__c = true);
    insert demo;
    demoAuthId = demo.Id;
    System.debug('BACKFILL|created demo authority ' + DEMO_CODE + ' / ' + DEMO_NAME);
} else {
    demoAuthId = existing[0].Id;
    System.debug('BACKFILL|demo authority already exists');
}

// 2. Assign internal users without an authority code to the demo authority.
// Best-effort: some User records carry org validation rules (e.g. a required
// Municipal__c) that we can't satisfy here — those users are skipped, not fatal.
List<User> users = [
    SELECT Id FROM User
    WHERE IsActive = true AND UserType = 'Standard' AND Authority_Code__c = null
];
for (User u : users) u.Authority_Code__c = DEMO_CODE;
Integer userOk = 0, userSkip = 0;
if (!users.isEmpty()) {
    for (Database.SaveResult sr : Database.update(users, false)) {
        if (sr.isSuccess()) { userOk++; } else { userSkip++; }
    }
}
System.debug('BACKFILL|users stamped=' + userOk + ' skipped=' + userSkip);

// 3. Backfill templates — flat Authority_Code__c is the writeable isolation key the
// template restriction rule matches; also link the Authority__c lookup for consistency.
List<Form_Template__c> tpls = [SELECT Id, Authority__c FROM Form_Template__c WHERE Authority_Code__c = null];
for (Form_Template__c t : tpls) {
    t.Authority_Code__c = DEMO_CODE;
    if (t.Authority__c == null) t.Authority__c = demoAuthId;
}
if (!tpls.isEmpty()) { update tpls; }
System.debug('BACKFILL|templates stamped=' + tpls.size());

// 4. Backfill responses — set the Authority__c lookup (Authority_Code__c is a read-only
// formula) and the stamped Tenant_Code__c, which is the field the response restriction
// rule matches (restriction rules can't filter on formula fields).
List<Form_Response__c> resp = [
    SELECT Id, Authority__c, Tenant_Code__c FROM Form_Response__c
    WHERE Authority__c = null OR Tenant_Code__c = null
];
for (Form_Response__c r : resp) {
    if (r.Authority__c == null) r.Authority__c = demoAuthId;
    if (String.isBlank(r.Tenant_Code__c)) r.Tenant_Code__c = DEMO_CODE;
}
if (!resp.isEmpty()) { update resp; }
System.debug('BACKFILL|responses stamped=' + resp.size());

System.debug('BACKFILL|done');
