const { withConnection } = require('../salesforceClient');
const config = require('../config');

function escapeSoql(value) {
  return String(value).replace(/[\\']/g, '\\$&');
}

async function findAccountByIdentification(idType, idNumber) {
  return withConnection(async (conn) => {
    const result = await conn.query(
      `SELECT Id, FirstName, LastName, Type, Municipal__c FROM Account ` +
      `WHERE IdentificationType__pc = '${escapeSoql(idType)}' AND IdNumber__pc = '${escapeSoql(idNumber)}' LIMIT 1`
    );
    return result.records[0] || null;
  });
}

async function createAccount({ idType, idNumber, firstName, lastName, callerType, municipal }) {
  return withConnection(async (conn) => {
    const record = {
      IdentificationType__pc: idType,
      IdNumber__pc: idNumber,
      FirstName: firstName,
      LastName: lastName,
      Type: callerType,
      Municipal__c: municipal,
    };
    if (config.salesforce.personAccountRecordTypeId) {
      record.RecordTypeId = config.salesforce.personAccountRecordTypeId;
    }
    const res = await conn.sobject('Account').create(record);
    if (!res.success) throw new Error(`Account creation failed: ${JSON.stringify(res.errors)}`);
    return res.id;
  });
}

async function findOrCreateAccount(input) {
  const existing = await findAccountByIdentification(input.idType, input.idNumber);
  if (existing) return { id: existing.Id, isNew: false };
  const id = await createAccount(input);
  return { id, isNew: true };
}

async function findContactPointPhone(phoneNumber) {
  return withConnection(async (conn) => {
    const result = await conn.query(
      `SELECT Id, ParentId FROM ContactPointPhone WHERE TelephoneNumber = '${escapeSoql(phoneNumber)}' LIMIT 1`
    );
    return result.records[0] || null;
  });
}

async function findOrCreateContactPointPhone({ accountId, phone, municipal }) {
  const existing = await findContactPointPhone(phone.number);
  if (existing && existing.ParentId === accountId) {
    return { id: existing.Id, isNew: false };
  }

  return withConnection(async (conn) => {
    const otherPhones = await conn.query(
      `SELECT Id FROM ContactPointPhone WHERE ParentId = '${escapeSoql(accountId)}' LIMIT 1`
    );
    const record = {
      OwnerId: config.salesforce.contactPointOwnerId || undefined,
      Name: phone.number,
      ParentId: accountId,
      ActiveFromDate: new Date().toISOString().slice(0, 10),
      IsPrimary: otherPhones.records.length === 0,
      TelephoneNumber: phone.number,
      IsSmsCapable: !!phone.isSmsCapable,
      IsPersonalPhone: !!phone.isPersonalPhone,
      IsBusinessPhone: !!phone.isBusinessPhone,
      Departments__c: 'Horizontal',
      Municipal__c: municipal,
    };
    if (phone.usageType) record.UsageType = phone.usageType;
    if (phone.usagePhone) record.UsagePhone = phone.usagePhone;

    const res = await conn.sobject('ContactPointPhone').create(record);
    if (!res.success) throw new Error(`ContactPointPhone creation failed: ${JSON.stringify(res.errors)}`);
    return { id: res.id, isNew: true };
  });
}

module.exports = { findOrCreateAccount, findOrCreateContactPointPhone };
