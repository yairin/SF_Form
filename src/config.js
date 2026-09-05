require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,

  salesforce: {
    loginUrl: process.env.SF_LOGIN_URL || 'https://test.salesforce.com',
    username: process.env.SF_USERNAME,
    password: process.env.SF_PASSWORD,
    securityToken: process.env.SF_SECURITY_TOKEN || '',
    // Connected App consumer key/secret. When set, login uses the OAuth2
    // username-password flow scoped to this Connected App instead of the
    // legacy SOAP login() call — required by orgs where the user's profile
    // lacks "Use Any API Client" (see API_IMPLEMENTATION_NOTES.md).
    clientId: process.env.SF_CLIENT_ID || '',
    clientSecret: process.env.SF_CLIENT_SECRET || '',
    // Person Account record type ("חשבון אישי") — confirmed via discover-sf-schema
    // against the real sandbox: 012Wn0000004InxIAE (also the org's default Account
    // record type, so Salesforce would likely apply it even if left unset — set
    // explicitly anyway for clarity).
    personAccountRecordTypeId: process.env.SF_PERSON_ACCOUNT_RECORD_TYPE_ID || '',
    // OwnerId to stamp on newly created ContactPointPhone records ("יוזר מערכת שיוקצה לכך").
    contactPointOwnerId: process.env.SF_CONTACT_POINT_OWNER_ID || '',
  },

  // Case.OwnerId is a REQUIRED field (reference -> Group, User) in this org — confirmed
  // via discover-sf-schema. Must be set to a real User or Queue Id before case creation
  // will succeed; there is no sane code default, so this must come from .env.
  caseDefaultOwnerId: process.env.SF_CASE_DEFAULT_OWNER_ID || '',

  // Case field API names — confirmed against the real sandbox via discover-sf-schema.
  // category/topic/subtopic are plain PICKLISTS (not lookups, despite what the source
  // doc implied with its RegulatoryAuthorizationType__r__... relationship-path names) —
  // their valid values are municipality-specific (e.g. suffixed "- 634"), supplied to
  // the AI as a catalog per the source spec, so we pass whatever string arrives straight
  // through rather than validating against a fixed list.
  caseFields: {
    category: process.env.SF_CASE_FIELD_CATEGORY || 'Category__c',
    topic: process.env.SF_CASE_FIELD_TOPIC || 'Topic__c',
    subtopic: process.env.SF_CASE_FIELD_SUBTOPIC || 'Sub_Topic__c',
    caseRoute: process.env.SF_CASE_FIELD_CASE_ROUTE || 'CaseRoute__c',
    location: process.env.SF_CASE_FIELD_LOCATION || 'Location__c',
    address: process.env.SF_CASE_FIELD_ADDRESS || 'Address__c',
  },

  // OAuth2 client_credentials issued by this API to the AI phone system.
  auth: {
    clientId: process.env.AI_CLIENT_ID || '',
    clientSecret: process.env.AI_CLIENT_SECRET || '',
    jwtSecret: process.env.JWT_SECRET || '',
    tokenTtlSeconds: parseInt(process.env.AI_TOKEN_TTL_SECONDS || '3600', 10),
  },
};
