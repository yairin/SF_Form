'use strict';

/**
 * Emergency-event Salesforce integration.
 *
 * Creates records on the "מאגר חירום" event object via an authenticated
 * jsforce connection (a custom object cannot use Web-to-Lead — only the
 * standard Lead/Case objects can, so an authenticated API call is required).
 *
 * ── Configuring the field mapping ──────────────────────────────────────────
 * The object API name and every field are read from environment variables so
 * they can be adjusted to the real schema WITHOUT editing this file. Retrieve
 * the object with `scripts/sf-retrieve.sh CustomApplication`, note the real
 * API names, and set the SF_EMERGENCY_* / SF_F_* vars in `.env` accordingly.
 * The defaults below are placeholders and will almost certainly need changing.
 */

const jsforce = require('jsforce');

const OBJECT = process.env.SF_EMERGENCY_OBJECT || 'Emergency_Event__c';

// Form field -> Salesforce field API name. Override any of these via .env.
const FIELD = {
  title:       process.env.SF_F_TITLE       || 'Name',
  type:        process.env.SF_F_TYPE        || 'Event_Type__c',
  severity:    process.env.SF_F_SEVERITY    || 'Severity__c',
  location:    process.env.SF_F_LOCATION    || 'Location__c',
  description: process.env.SF_F_DESCRIPTION || 'Description__c',
  reporter:    process.env.SF_F_REPORTER    || 'Reporter_Name__c',
  phone:       process.env.SF_F_PHONE       || 'Contact_Phone__c',
  casualties:  process.env.SF_F_CASUALTIES  || 'Casualties_Count__c',
  status:      process.env.SF_F_STATUS      || 'Status__c',
  occurredAt:  process.env.SF_F_OCCURRED_AT || 'Occurred_At__c',
};

const DEFAULT_STATUS = process.env.SF_EMERGENCY_DEFAULT_STATUS || 'פתוח';

let conn = null;

/** Lazily create and cache an authenticated jsforce connection. */
async function getConnection() {
  if (conn && conn.accessToken) return conn;

  const { SF_LOGIN_URL, SF_USERNAME, SF_PASSWORD, SF_SECURITY_TOKEN } = process.env;
  if (!SF_USERNAME || !SF_PASSWORD) {
    throw new Error('Salesforce credentials are not configured (SF_USERNAME / SF_PASSWORD).');
  }

  conn = new jsforce.Connection({
    loginUrl: SF_LOGIN_URL || 'https://test.salesforce.com',
  });
  await conn.login(SF_USERNAME, `${SF_PASSWORD}${SF_SECURITY_TOKEN || ''}`);
  return conn;
}

/** Build the Salesforce record payload from validated form data. */
function buildRecord(data) {
  const record = {
    [FIELD.title]:       data.title.trim(),
    [FIELD.type]:        data.type,
    [FIELD.severity]:    data.severity,
    [FIELD.location]:    data.location.trim(),
    [FIELD.description]: data.description.trim(),
    [FIELD.reporter]:    data.reporter.trim(),
    [FIELD.phone]:       data.phone.trim(),
    [FIELD.status]:      DEFAULT_STATUS,
  };
  if (data.casualties !== undefined && data.casualties !== null && data.casualties !== '') {
    record[FIELD.casualties] = Number(data.casualties);
  }
  if (data.occurredAt) {
    record[FIELD.occurredAt] = data.occurredAt;
  }
  return record;
}

/**
 * Create an emergency-event record.
 * @returns {Promise<{id: string}>}
 */
async function createEmergencyEvent(data) {
  const connection = await getConnection();
  const result = await connection.sobject(OBJECT).create(buildRecord(data));

  if (!result.success) {
    const reason = Array.isArray(result.errors) ? result.errors.join('; ') : 'unknown error';
    throw new Error(`Salesforce rejected the record: ${reason}`);
  }
  return { id: result.id };
}

/** Lightweight connectivity check for the health endpoint. */
async function checkConnection() {
  const connection = await getConnection();
  await connection.identity();
  return { object: OBJECT, instanceUrl: connection.instanceUrl };
}

module.exports = { createEmergencyEvent, checkConnection, OBJECT, FIELD };
