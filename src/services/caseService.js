const { withConnection } = require('../salesforceClient');
const config = require('../config');
const { CASE_ORIGIN_PHONE } = require('../constants');

const SUBJECT_PREFIX = 'פניה טלפונית: ';
const SUBJECT_MAX_LEN = 255;
const SUMMARY_MAX_LEN = 1000;
const DESCRIPTION_MAX_LEN = 32000;

function buildSubject(aiSubject) {
  const subject = `${SUBJECT_PREFIX}${(aiSubject || '').trim()}`;
  return subject.slice(0, SUBJECT_MAX_LEN);
}

function buildDescription({ language, callReceivedAt, openedAt, summary }) {
  const header =
    `שפת הפונה: ${language || 'עברית'}\n` +
    `מועד קבלת השיחה: ${callReceivedAt}\n` +
    `מועד פתיחת הפניה: ${openedAt}`;
  const truncatedSummary = (summary || '').slice(0, SUMMARY_MAX_LEN);
  return `${header}\n\n${truncatedSummary}`.slice(0, DESCRIPTION_MAX_LEN);
}

async function findOpenCaseForAccount(accountId) {
  return withConnection(async (conn) => {
    const result = await conn.query(
      `SELECT Id, CaseNumber, Subject, ${config.caseFields.subtopic} FROM Case ` +
      `WHERE AccountId = '${accountId}' AND IsClosed = false ORDER BY CreatedDate DESC LIMIT 1`
    );
    return result.records[0] || null;
  });
}

async function createCase(input) {
  return withConnection(async (conn) => {
    const record = {
      Subject: buildSubject(input.subject),
      Type: input.type,
      Origin: CASE_ORIGIN_PHONE,
      Description: buildDescription(input),
      Municipal__c: input.municipal,
      AnonymousCase__c: !input.accountId,
    };
    if (input.accountId) record.AccountId = input.accountId;
    if (input.categoryId) record[config.caseFields.category] = input.categoryId;
    if (input.topicId) record[config.caseFields.topic] = input.topicId;
    if (input.subtopicId) record[config.caseFields.subtopic] = input.subtopicId;
    if (input.caseRouteId) record[config.caseFields.caseRoute] = input.caseRouteId;
    if (input.locationId) record[config.caseFields.location] = input.locationId;
    if (input.addressId) record[config.caseFields.address] = input.addressId;

    const res = await conn.sobject('Case').create(record);
    if (!res.success) throw new Error(`Case creation failed: ${JSON.stringify(res.errors)}`);

    const created = await conn.sobject('Case').retrieve(res.id);
    return { id: res.id, caseNumber: created.CaseNumber };
  });
}

module.exports = { findOpenCaseForAccount, createCase, buildSubject, buildDescription };
