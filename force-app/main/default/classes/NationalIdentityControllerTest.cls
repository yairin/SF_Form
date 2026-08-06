@isTest
private class NationalIdentityControllerTest {

    // Pure mapping — a user carrying a FederationIdentifier is reported identified,
    // with the national id echoed. No DML/SOQL, so it is deterministic in any org.
    @isTest
    static void toIdentityFederatedUser() {
        User u = new User(FederationIdentifier = '039573187',
                          FirstName = 'ישראל', LastName = 'ישראלי', Email = 'x@example.com.invalid');
        NationalIdentityController.Identity id = NationalIdentityController.toIdentity(u);
        System.assertEquals(true, id.identified, 'federated user is identified');
        System.assertEquals('039573187', id.idNumber, 'national id echoed from FederationIdentifier');
        System.assertEquals('ישראל', id.firstName);
        System.assertEquals('ישראלי', id.lastName);
    }

    // No FederationIdentifier (or null) => not identified, so guest/anonymous forms are untouched.
    @isTest
    static void toIdentityGuestOrNull() {
        System.assertEquals(false, NationalIdentityController.toIdentity(new User()).identified,
            'blank FederationIdentifier => not identified');
        System.assertEquals(false, NationalIdentityController.toIdentity(null).identified,
            'null user => not identified');
    }

    // Exercises the SOQL path for the running user; asserts only that it never throws
    // and returns a value (the running user's federation state is org-dependent).
    @isTest
    static void getIdentityForCurrentUserDoesNotThrow() {
        Test.startTest();
        NationalIdentityController.Identity id = NationalIdentityController.getIdentity();
        Test.stopTest();
        System.assertNotEquals(null, id, 'getIdentity always returns an Identity');
    }

    @isTest
    static void configEndpointsAndLogout() {
        System.assert(NationalAuthConfig.ssoUrl().startsWith('https://'), 'sso url configured');
        System.assert(NationalAuthConfig.metadataUrl().contains('/metadata'), 'metadata url configured');
        System.assert(NationalAuthConfig.sloUrl().contains('/slo'), 'slo url configured');
        System.assertEquals(false, NationalAuthConfig.isProduction(), 'defaults to the test environment');
        System.assert(NationalAuthConfig.logoutUrl('https://example.gov.il/done').contains('forwardURL='),
            'logout carries a forward url');
        System.assert(String.isNotBlank(NationalAuthConfig.logoutUrl(null)), 'blank forward url still returns a url');
    }
}
