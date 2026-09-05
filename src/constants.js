const IDENTIFICATION_TYPES = ['IsraeliID', 'Passport'];

const ACCOUNT_TYPES = [
  'Competitor', 'Customer', 'Integrator', 'Investor', 'Partner', 'Press', 'Prospect',
  'Reseller', 'Other', 'Resident', 'Passerby', 'High School / Secondary School',
  'Preschool', 'Post-Secondary Institution', 'Specialized School', 'College',
  'University', 'Learning Center', 'Private Educational Institution',
  'Vocational / Technical School', 'Kindergarten', 'Visitor', 'Worker',
  'Unauthorized Person', 'Government Organization', 'Nonprofit Organization',
  'Medical Organization', 'Financial Organization', 'Legal Entity',
  'Industrial Organization', 'Security Body', 'Community Organization',
  'Sports Organization', 'Environmental Organization', 'Arts and Culture Organization',
  'Scientific Research Organization', 'Tourism Organization', 'Real Estate Organization',
  'HouseHold', 'External Contractor', 'Business Owner', 'External Contact',
];

// Confirmed against the real sandbox via `npm run discover-sf-schema` (Case.Type picklist).
const CASE_TYPES = { info: 'Info case', service: 'service case' };

// Confirmed real picklist value on Case.Origin — NOT 'טלפון' (Hebrew) as originally
// guessed from the source doc. Case.Origin values in this org are English:
// [Email, Phone, Authority website/form, Facebook Messenger message, WhatsApp, Manual]
const CASE_ORIGIN_PHONE = 'Phone';

const USAGE_TYPES = ['Home', 'Work', 'Temporary', 'Other'];
const USAGE_PHONES = ['Home', 'Mobile', 'spouse'];

// Confirmed real picklist values on Account.Municipal__c / Case.Municipal__c.
const MUNICIPAL_VALUES = ['משמ', '634', '1200', '6600', '229', '8400', '4000', '9100', '2034', '4203', '12345', '6100', '494', '195'];

module.exports = {
  IDENTIFICATION_TYPES,
  ACCOUNT_TYPES,
  CASE_TYPES,
  CASE_ORIGIN_PHONE,
  USAGE_TYPES,
  USAGE_PHONES,
  MUNICIPAL_VALUES,
};
