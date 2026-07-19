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

    // Fail-closed: a non-admin without an authority code is still scoped, and binds a null
    // code that matches no stamped record (so they see nothing rather than everything).
    @isTest
    static void scopedUserWithBlankCodeSeesNothing() {
        AuthorityScope.loaded = true;
        AuthorityScope.code = null;
        AuthorityScope.scoped = true;
        System.assertEquals(' AND Tenant_Code__c = :authorityScopeCode',
            AuthorityScope.clause('Tenant_Code__c'), 'scoped even with a blank code');
        System.assertEquals(null, AuthorityScope.currentCode(), 'blank code binds null => matches nothing');
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
