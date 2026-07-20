/**
 * Per-authority (multi-tenant) row scoping enforced at the Apex query layer.
 *
 * Restriction Rules were the preferred mechanism, but this org rejects a
 * $User.<custom field> criterion in a restriction-rule recordFilter (and the
 * filter is validated even when the rule is inactive), so isolation is enforced
 * here instead. The isolation keys are the stamped Text fields Form_Template__c.
 * Authority_Code__c and Form_Response__c.Tenant_Code__c (a real field, since neither
 * restriction rules nor this scoping can filter on a formula field).
 *
 * Semantics (fail-closed, mirroring restriction-rule bypass): ONLY users with
 * "View All Data" (technical admins / developers) are unscoped and see everything.
 * Every other user is scoped to their own authority code — and a business user
 * whose code is blank (a provisioning gap) therefore matches no stamped record and
 * sees nothing, rather than leaking cross-authority data. The code is provisioned
 * from User.Municipal__c (locality code) by a before-save Flow.
 */
public with sharing class AuthorityScope {

    @TestVisible private static Boolean loaded = false;
    @TestVisible private static String code;
    @TestVisible private static Boolean scoped;

    /** The running user's authority code (isolation key), or null when they have none. */
    public static String currentCode() {
        load();
        return code;
    }

    /** True when the running user's data access must be narrowed to their own authority. */
    public static Boolean isScoped() {
        load();
        return scoped;
    }

    private static void load() {
        if (loaded) return;
        loaded = true;
        List<User> us = [SELECT Authority_Code__c FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
        code = us.isEmpty() ? null : us[0].Authority_Code__c;
        // Fail-closed: everyone who is not a View All Data admin is scoped. A scoped user
        // with a blank code binds :authorityScopeCode = null, which matches no stamped record.
        scoped = !viewAllData();
    }

    // PermissionSetAssignment includes the profile's implicit permission set, so this
    // one query covers View All Data granted via either a profile or a permission set.
    private static Boolean viewAllData() {
        for (PermissionSetAssignment a : [
            SELECT PermissionSet.PermissionsViewAllData
            FROM PermissionSetAssignment
            WHERE AssigneeId = :UserInfo.getUserId()
        ]) {
            if (a.PermissionSet.PermissionsViewAllData) return true;
        }
        return false;
    }

    /**
     * Returns an extra SOQL predicate that narrows a query to the running user's
     * authority via the given field, or '' when the user is unscoped. The field must
     * hold the authority code (Form_Template__c.Authority_Code__c / Form_Response__c.
     * Tenant_Code__c). Callers bind :authorityScopeCode when the clause is non-empty.
     */
    public static String clause(String fieldApiName) {
        if (!isScoped()) return '';
        // A scoped user with a blank code must see NOTHING. Binding :authorityScopeCode = null
        // would instead match every record whose code is also null/blank (SOQL `field = null`),
        // leaking un-stamped data — so emit an unsatisfiable predicate in that case.
        if (String.isBlank(currentCode())) {
            return ' AND ' + fieldApiName + ' = null AND ' + fieldApiName + ' != null';
        }
        return ' AND ' + fieldApiName + ' = :authorityScopeCode';
    }

    /** Guard a single record reached by id/external id: block cross-authority access. */
    public static void assertOwn(String recordAuthorityCode) {
        if (!isScoped()) return;
        // Blank-code scoped user: deny outright (null != null is false in Apex, which would
        // otherwise let a blank-code user through to blank-code records).
        if (String.isBlank(currentCode()) || recordAuthorityCode != currentCode()) {
            throw new AuraHandledException('אין לך הרשאה לצפות בנתונים של רשות אחרת.');
        }
    }
}
