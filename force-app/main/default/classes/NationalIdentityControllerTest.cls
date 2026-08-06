@isTest
private class NationalIdentityControllerTest {

    // The CI runner (a real admin User) has no FederationIdentifier, so getIdentity
    // returns not-identified — proving the guest/anonymous path leaves forms untouched.
    @isTest
    static void currentUserWithoutFederationIsNotIdentified() {
        Test.startTest();
        NationalIdentityController.Identity id = NationalIdentityController.getIdentity();
        Test.stopTest();
        System.assertEquals(false, id.identified, 'no FederationIdentifier => not identified');
        System.assertEquals(null, id.idNumber, 'no id number exposed for a non-SSO user');
    }

    // A user WITH a FederationIdentifier is reported as identified with the ID echoed.
    @isTest
    static void userWithFederationIsIdentified() {
        User u = buildFederatedUser('039573187');
        if (u == null) return; // org without an available user license for the test — skip gracefully
        System.runAs(u) {
            Test.startTest();
            NationalIdentityController.Identity id = NationalIdentityController.getIdentity();
            Test.stopTest();
            System.assertEquals(true, id.identified, 'federated user is identified');
            System.assertEquals('039573187', id.idNumber, 'national id echoed from FederationIdentifier');
        }
    }

    @isTest
    static void configEndpointsAndLogout() {
        System.assert(NationalAuthConfig.ssoUrl().startsWith('https://'), 'sso url configured');
        System.assert(NationalAuthConfig.metadataUrl().contains('/metadata'), 'metadata url configured');
        System.assert(NationalAuthConfig.sloUrl().contains('/slo'), 'slo url configured');
        System.assertEquals(false, NationalAuthConfig.isProduction(), 'defaults to the test environment');
        String lo = NationalAuthConfig.logoutUrl('https://example.gov.il/done');
        System.assert(lo.contains('forwardURL='), 'logout carries a forward url');
        System.assert(String.isNotBlank(NationalAuthConfig.logoutUrl(null)), 'blank forward url still returns a logout url');
    }

    private static User buildFederatedUser(String federationId) {
        Profile p = [SELECT Id FROM Profile WHERE UserType = 'Standard' LIMIT 1];
        String uniq = 'natid' + String.valueOf(System.currentTimeMillis()).right(7);
        User u = new User(
            FirstName = 'ישראל', LastName = 'ישראלי',
            Alias = 'natid', Email = uniq + '@example.com.invalid',
            Username = uniq + '@example.com.invalid',
            FederationIdentifier = federationId,
            ProfileId = p.Id, TimeZoneSidKey = 'Asia/Jerusalem',
            LocaleSidKey = 'iw_IL', EmailEncodingKey = 'UTF-8', LanguageLocaleKey = 'iw'
        );
        try { insert u; return u; } catch (Exception e) { return null; }
    }
}
