// One-shot schema discovery: connects to Salesforce with the credentials in
// .env and prints exactly the config values API_IMPLEMENTATION_NOTES.md flags
// as unconfirmed (Person Account record type, Case lookup field API names,
// picklist values) — so filling in the remaining .env vars doesn't require
// manually clicking through Object Manager.
//
// Usage: cp .env.example .env, fill in SF_LOGIN_URL/SF_USERNAME/SF_PASSWORD/
// SF_SECURITY_TOKEN, then: npm run discover-sf-schema
require('dotenv').config();
const jsforce = require('jsforce');

const OBJECTS_TO_DESCRIBE = ['Account', 'Case', 'ContactPointPhone'];
const ALWAYS_SHOW_FIELDS = new Set([
  'Type', 'Origin', 'Status', 'Priority', 'IsClosed', 'AccountId', 'OwnerId',
  'Subject', 'Description', 'RecordTypeId',
]);

function describeField(f) {
  let line = `    ${f.name} (${f.label}) type=${f.type}`;
  if (f.type === 'reference' && f.referenceTo && f.referenceTo.length) {
    line += ` -> ${f.referenceTo.join(', ')}`;
  }
  if (f.picklistValues && f.picklistValues.length) {
    line += ` picklist=[${f.picklistValues.map((p) => p.value).join(', ')}]`;
  }
  if (f.nillable === false && f.createable) line += ' REQUIRED';
  return line;
}

async function main() {
  const conn = new jsforce.Connection({ loginUrl: process.env.SF_LOGIN_URL || 'https://test.salesforce.com' });
  await conn.login(process.env.SF_USERNAME, `${process.env.SF_PASSWORD}${process.env.SF_SECURITY_TOKEN || ''}`);
  console.log(`Connected as ${process.env.SF_USERNAME} -> ${conn.instanceUrl}`);

  for (const objectName of OBJECTS_TO_DESCRIBE) {
    const describe = await conn.sobject(objectName).describe();
    console.log(`\n=== ${objectName} ===`);

    if (describe.recordTypeInfos && describe.recordTypeInfos.length) {
      console.log('  Record Types:');
      describe.recordTypeInfos.forEach((rt) => {
        console.log(`    ${rt.name} — Id=${rt.recordTypeId} available=${rt.available} default=${rt.defaultRecordTypeMapping}`);
      });
    }

    console.log('  Fields (custom, or standard fields this API relies on):');
    describe.fields
      .filter((f) => f.custom || ALWAYS_SHOW_FIELDS.has(f.name))
      .forEach((f) => console.log(describeField(f)));
  }

  console.log('\n=== Next steps ===');
  console.log('- Copy the relevant Record Type Id into SF_PERSON_ACCOUNT_RECORD_TYPE_ID');
  console.log('- Match the Case lookup fields above to SF_CASE_FIELD_CATEGORY/TOPIC/SUBTOPIC/CASE_ROUTE/LOCATION/ADDRESS');
  console.log('- Compare the printed picklist values against src/constants.js and adjust either side if they differ');
}

main().catch((err) => {
  console.error('Discovery failed:', err.message);
  process.exit(1);
});
