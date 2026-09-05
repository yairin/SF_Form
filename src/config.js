require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,

  salesforce: {
    loginUrl: process.env.SF_LOGIN_URL || 'https://test.salesforce.com',
    username: process.env.SF_USERNAME,
    password: process.env.SF_PASSWORD,
    securityToken: process.env.SF_SECURITY_TOKEN || '',
    // Person Account record type — required to create Account records correctly.
    // Needs to be confirmed with the org admin (see API_IMPLEMENTATION_NOTES.md).
    personAccountRecordTypeId: process.env.SF_PERSON_ACCOUNT_RECORD_TYPE_ID || '',
    // OwnerId to stamp on newly created ContactPointPhone records ("יוזר מערכת שיוקצה לכך").
    contactPointOwnerId: process.env.SF_CONTACT_POINT_OWNER_ID || '',
  },

  // Case lookup field API names. The source document gives some of these as
  // SOQL relationship paths (e.g. RegulatoryAuthorizationType__r__IssuingDepartment__PrimaryType__c)
  // rather than real field API names — these defaults are best-effort and MUST
  // be confirmed with the org admin before going live (see API_IMPLEMENTATION_NOTES.md).
  caseFields: {
    category: process.env.SF_CASE_FIELD_CATEGORY || 'PrimaryType__c',
    topic: process.env.SF_CASE_FIELD_TOPIC || 'IssuingDepartmentId__c',
    subtopic: process.env.SF_CASE_FIELD_SUBTOPIC || 'RegulatoryAuthorizationType__c',
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
