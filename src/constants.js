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

// Verbatim from the source spec ("פניית מידע (Info case)" / "פניית שירות (service case)").
// Casing looks inconsistent between the two — confirm the exact stored values with the org admin.
const CASE_TYPES = { info: 'Info case', service: 'service case' };

const CASE_ORIGIN_PHONE = 'טלפון';

const USAGE_TYPES = ['Home', 'Work', 'Temporary', 'Other'];
const USAGE_PHONES = ['Home', 'Mobile', 'spouse'];

module.exports = {
  IDENTIFICATION_TYPES,
  ACCOUNT_TYPES,
  CASE_TYPES,
  CASE_ORIGIN_PHONE,
  USAGE_TYPES,
  USAGE_PHONES,
};
