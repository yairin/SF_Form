/**
 * Assign the SF_Forms_Public_Submit permission set to an Experience Cloud site's
 * Guest user — removes the fiddly "Public Access Settings" manual step.
 *
 * HOW TO RUN (after the LWR site exists):
 *   Setup → Developer Console → Debug → Open Execute Anonymous Window →
 *   paste this whole file → set SITE_NAME below to your site's name → Execute.
 *
 * Idempotent: safe to run more than once.
 */
String SITE_NAME = 'SF Forms Public';   // <-- שנה לשם האתר שיצרת ב-All Sites

Id psId = [SELECT Id FROM PermissionSet WHERE Name = 'SF_Forms_Public_Submit' LIMIT 1].Id;

List<Site> sites = [
    SELECT Id, Name, GuestUserId, MasterLabel
    FROM Site
    WHERE (Name = :SITE_NAME OR MasterLabel = :SITE_NAME) AND GuestUserId != null
    LIMIT 1
];

if (sites.isEmpty()) {
    System.debug(LoggingLevel.ERROR,
        'לא נמצא אתר בשם "' + SITE_NAME + '" עם משתמש Guest. ' +
        'ודא שהאתר נוצר ופורסם, וש-SITE_NAME תואם ל-Name/Label ב-All Sites.');
} else {
    Id guestUserId = sites[0].GuestUserId;
    Integer already = [
        SELECT COUNT()
        FROM PermissionSetAssignment
        WHERE AssigneeId = :guestUserId AND PermissionSetId = :psId
    ];
    if (already > 0) {
        System.debug('ההרשאה כבר מוקצית ל-Guest של "' + sites[0].Name + '" — לא נדרשת פעולה.');
    } else {
        insert new PermissionSetAssignment(AssigneeId = guestUserId, PermissionSetId = psId);
        System.debug('הוקצתה SF_Forms_Public_Submit ל-Guest user ' + guestUserId +
                     ' של האתר "' + sites[0].Name + '".');
    }
}
