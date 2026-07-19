// Creates two NON-admin test users in different authorities, to verify per-authority
// isolation (the running admin has View All Data and can't demonstrate it).
//
// Run manually AFTER the User provisioning Flow is deployed:
//   sf apex run --file scripts/provision-test-users.apex --target-org <org>
// Idempotent: skips users that already exist. Best-effort — if the org has no spare
// Salesforce licenses or the profile is missing, it logs and exits without throwing.
//
// Municipal__c is set (LAMAS locality code) so the User validation rule passes and the
// before-save Flow derives Authority_Code__c. Two codes => two authorities.

final String SUFFIX = '.mtdemo@sfform.test.invalid';
final Map<String, String> USERS = new Map<String, String>{
    'muni_a' => '0000',   // MuniForceCity (demo)
    'muni_b' => '4000'    // a second locality code, for cross-authority isolation checks
};

List<Profile> profs = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];
if (profs.isEmpty()) profs = [SELECT Id FROM Profile WHERE UserType = 'Standard' LIMIT 1];
if (profs.isEmpty()) { System.debug('TESTUSERS|no Standard profile found; abort'); return; }
Id profileId = profs[0].Id;

List<PermissionSet> mgr = [SELECT Id FROM PermissionSet WHERE Name = 'SF_Forms_Manager' LIMIT 1];

List<User> toInsert = new List<User>();
for (String alias : USERS.keySet()) {
    String uname = alias + SUFFIX;
    if (![SELECT Id FROM User WHERE Username = :uname LIMIT 1].isEmpty()) {
        System.debug('TESTUSERS|exists ' + uname);
        continue;
    }
    toInsert.add(new User(
        Username = uname,
        Email = alias + '@sfform.test.invalid',
        LastName = 'MT-Test-' + alias,
        Alias = alias.left(8),
        TimeZoneSidKey = 'Asia/Jerusalem',
        LocaleSidKey = 'iw_IL',
        EmailEncodingKey = 'UTF-8',
        LanguageLocaleKey = 'en_US',
        ProfileId = profileId,
        IsActive = true,
        Municipal__c = USERS.get(alias),
        Authority_Code__c = USERS.get(alias)
    ));
}

if (toInsert.isEmpty()) { System.debug('TESTUSERS|nothing to create'); return; }

try {
    insert toInsert;
    System.debug('TESTUSERS|created=' + toInsert.size());
    if (!mgr.isEmpty()) {
        List<PermissionSetAssignment> psas = new List<PermissionSetAssignment>();
        for (User u : toInsert) {
            psas.add(new PermissionSetAssignment(AssigneeId = u.Id, PermissionSetId = mgr[0].Id));
        }
        insert psas;
        System.debug('TESTUSERS|permset assigned=' + psas.size());
    }
} catch (Exception e) {
    System.debug('TESTUSERS|creation failed (likely no spare licenses): ' + e.getMessage());
}
