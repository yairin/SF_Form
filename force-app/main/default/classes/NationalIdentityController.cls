/**
 * Exposes the CURRENT Experience user's verified national identity to the guest
 * form so it can pre-fill and lock the ID / name fields after a national-auth login.
 *
 * "Identity for the form only" model: after the SAML login (handled by Salesforce's
 * off-the-shelf SP), the citizen is a lightweight identified user whose
 * FederationIdentifier is their national ID. This controller reads that back.
 * Guest-safe: an anonymous (not-yet-authenticated) user returns identified=false,
 * so existing anonymous forms are unaffected.
 */
public with sharing class NationalIdentityController {

    public class Identity {
        @AuraEnabled public Boolean identified = false;
        @AuraEnabled public String idNumber;   // מספר זהות (FederationIdentifier)
        @AuraEnabled public String firstName;  // שם פרטי
        @AuraEnabled public String lastName;   // שם משפחה
        @AuraEnabled public String fullName;
        @AuraEnabled public String email;
    }

    @AuraEnabled(cacheable=true)
    public static Identity getIdentity() {
        Identity id = new Identity();
        try {
            List<User> us = [
                SELECT FederationIdentifier, FirstName, LastName, Name, Email
                FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1
            ];
            if (us.isEmpty()) return id;
            User u = us[0];
            // A national-auth session sets FederationIdentifier to the 9-digit ID.
            // Guest / non-SSO users have it blank → treated as not identified.
            if (String.isBlank(u.FederationIdentifier)) return id;
            id.identified = true;
            id.idNumber = u.FederationIdentifier;
            id.firstName = u.FirstName;
            id.lastName = u.LastName;
            id.fullName = u.Name;
            id.email = u.Email;
        } catch (Exception e) {
            // Never break the form on an identity lookup failure.
            System.debug('NATIONALID|getIdentity failed: ' + e.getMessage());
        }
        return id;
    }
}
