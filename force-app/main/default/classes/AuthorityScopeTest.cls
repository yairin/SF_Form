@isTest
private class AuthorityScopeTest {

    // Exercises the real load()/viewAllData() path. The CI/test runner is a System
    // Administrator (View All Data), so fail-closed semantics leave them unscoped.
    @isTest
    static void viewAllDataAdminIsUnscoped() {
        Test.startTest();
        String code = AuthorityScope.currentCode();
        Boolean scoped = AuthorityScope.isScoped();
        Test.stopTest();
        System.assertEquals(false, scoped, 'a View All Data admin is unscoped');
        System.assertEquals('', AuthorityScope.clause('Tenant_Code__c'), 'unscoped => no extra predicate');
        AuthorityScope.assertOwn('anything'); // unscoped guard never throws
    }

    // Fail-closed: a non-admin without an authority code is still scoped, and gets an
    // UNSATISFIABLE predicate so they see nothing — not the null-code records that a plain
    // `field = :bind` (bind = null) would have matched (SOQL `field = null` matches nulls).
    @isTest
    static void scopedUserWithBlankCodeSeesNothing() {
        AuthorityScope.loaded = true;
        AuthorityScope.code = null;
        AuthorityScope.scoped = true;
        System.assertEquals(' AND Tenant_Code__c = null AND Tenant_Code__c != null',
            AuthorityScope.clause('Tenant_Code__c'), 'blank-code scoped user => unsatisfiable predicate');
        System.assertEquals(null, AuthorityScope.currentCode(), 'blank code => matches nothing');

        // And the single-record guard denies a blank-code scoped user outright, even against
        // a record whose code is also blank (null != null would otherwise be false → leak).
        Boolean threw = false;
        try {
            AuthorityScope.assertOwn(null);
        } catch (AuraHandledException e) {
            threw = true;
        }
        System.assert(threw, 'blank-code scoped user is denied by the single-record guard');
    }

    @isTest
    static void scopedUserGetsClauseAndGuard() {
        // Inject a scoped state (avoids creating a User, which trips the org's Municipal__c rule).
        AuthorityScope.loaded = true;
        AuthorityScope.code = '0000';
        AuthorityScope.scoped = true;

        System.assertEquals('0000', AuthorityScope.currentCode());
        System.assertEquals(true, AuthorityScope.isScoped());
        System.assertEquals(' AND Tenant_Code__c = :authorityScopeCode',
            AuthorityScope.clause('Tenant_Code__c'), 'scoped => appends the authority predicate');

        AuthorityScope.assertOwn('0000'); // same authority: allowed

        Boolean threw = false;
        try {
            AuthorityScope.assertOwn('9999');
        } catch (AuraHandledException e) {
            threw = true;
        }
        System.assert(threw, 'scoped user is blocked from another authority');
    }
}
