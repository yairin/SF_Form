@isTest
private class AuthorityScopeTest {

    // Exercises the real load()/viewAllData() path for the running test user, who has
    // no authority code and is therefore unscoped.
    @isTest
    static void runningUserUnscopedByDefault() {
        Test.startTest();
        String code = AuthorityScope.currentCode();
        Boolean scoped = AuthorityScope.isScoped();
        Test.stopTest();
        System.assertEquals(false, scoped, 'a user without an authority code is unscoped');
        System.assertEquals('', AuthorityScope.clause('Tenant_Code__c'), 'unscoped => no extra predicate');
        AuthorityScope.assertOwn('anything'); // unscoped guard never throws
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
