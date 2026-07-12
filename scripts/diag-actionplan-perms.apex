// מזהה PSL/Permission Sets רלוונטיים ל-Action Plans/Industries ואת הקצאות המשתמש הנוכחי.
Id me = UserInfo.getUserId();
System.debug('USER|' + UserInfo.getName() + '|' + UserInfo.getUserName());

System.debug('--- PermissionSetLicenses בארגון (Industries/ActionPlan/PublicSector) ---');
for (PermissionSetLicense psl : [SELECT DeveloperName, MasterLabel, TotalLicenses, UsedLicenses, Status
        FROM PermissionSetLicense ORDER BY MasterLabel]) {
    String n = (psl.DeveloperName + ' ' + psl.MasterLabel).toLowerCase();
    if (n.contains('action') || n.contains('industr') || n.contains('public') || n.contains('service') || n.contains('psl'))
        System.debug('PSL|' + psl.MasterLabel + '|' + psl.DeveloperName + '|status=' + psl.Status + '|used=' + psl.UsedLicenses + '/' + psl.TotalLicenses);
}

System.debug('--- PermissionSets (Industries/ActionPlan) ---');
for (PermissionSet ps : [SELECT Name, Label, LicenseId, License.MasterLabel FROM PermissionSet
        WHERE (Name LIKE '%ction%' OR Name LIKE '%ndustr%' OR Name LIKE '%ublicSector%' OR Label LIKE '%Action%') LIMIT 50]) {
    System.debug('PS|' + ps.Label + '|' + ps.Name + '|license=' + ps.License.MasterLabel);
}

System.debug('--- PSL שכבר מוקצים למשתמש ---');
for (PermissionSetLicenseAssign a : [SELECT PermissionSetLicense.MasterLabel FROM PermissionSetLicenseAssign WHERE AssigneeId = :me]) {
    System.debug('MY_PSL|' + a.PermissionSetLicense.MasterLabel);
}
