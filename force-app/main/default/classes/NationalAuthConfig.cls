/**
 * Central configuration for the national-authentication (הזדהות לאומית) SAML
 * integration. Endpoints are taken verbatim from the מערך הדיגיטל technical annex
 * (SAML 2, v2.4). Switch ENVIRONMENT to 'Production' when moving off the test env
 * (only after PT + connection approval — see docs/NATIONAL_AUTH.md).
 *
 * Kept as an Apex class (not a Custom Metadata type) so it is fully source-controlled
 * and deploys cleanly; these endpoints change rarely and a change is a deploy anyway.
 */
public with sharing class NationalAuthConfig {

    // 'Test' (st.login.gov.il — closed, IP-whitelisted) or 'Production' (login.gov.il).
    public static final String ENVIRONMENT = 'Test';

    // Minimum acceptable level of assurance (רב"א). The assertion returns 3–4.
    public static final Integer MIN_LOA = 3;

    private static final Map<String, Map<String, String>> ENDPOINTS = new Map<String, Map<String, String>>{
        'Test' => new Map<String, String>{
            'sso'      => 'https://st.login.gov.il/nidp/saml2/sso',
            'metadata' => 'https://st.login.gov.il/nidp/saml2/metadata',
            'slo'      => 'https://st.login.gov.il/nidp/saml2/slo',
            'logout'   => 'https://st.gov.il/mw/logout.html'
        },
        'Production' => new Map<String, String>{
            'sso'      => 'https://login.gov.il/nidp/saml2/sso',
            'metadata' => 'https://login.gov.il/nidp/saml2/metadata',
            'slo'      => 'https://login.gov.il/nidp/saml2/slo',
            'logout'   => 'https://gov.il/mw/logout.html'
        }
    };

    public static Boolean isProduction() { return ENVIRONMENT == 'Production'; }

    private static String endpoint(String key) {
        Map<String, String> m = ENDPOINTS.get(ENVIRONMENT);
        return (m != null && m.containsKey(key)) ? m.get(key) : ENDPOINTS.get('Test').get(key);
    }

    public static String ssoUrl()      { return endpoint('sso'); }
    public static String metadataUrl() { return endpoint('metadata'); }
    public static String sloUrl()      { return endpoint('slo'); }

    /**
     * Simple gov logout redirect (annex §5.2.1). Returns the citizen to forwardUrl
     * (which must be a NON-identified page). If forwardUrl is blank, the IdP routes
     * to GOV. See docs/NATIONAL_AUTH.md.
     */
    public static String logoutUrl(String forwardUrl) {
        String base = endpoint('logout');
        return String.isBlank(forwardUrl) ? base
            : base + '?forwardURL=' + EncodingUtil.urlEncode(forwardUrl, 'UTF-8');
    }
}
