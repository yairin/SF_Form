// One-shot real Case creation test — bypasses the Express/OAuth layer and calls
// the service functions directly, so it can be run locally with just .env filled
// in. Creates ONE clearly-labeled anonymous test Case so we can check in the
// Salesforce UI whether OwnerId, Category/Topic/Sub-Topic, and Municipal__c all
// behaved as expected — then DELETE IT MANUALLY afterwards.
//
// Usage: npm run test-create-case
const { createCase } = require('../src/services/caseService');
const { MUNICIPAL_VALUES } = require('../src/constants');

async function main() {
  const municipal = MUNICIPAL_VALUES[0];
  console.log(`Creating a test Case (municipality="${municipal}")...`);

  const result = await createCase({
    accountId: null, // anonymous — skips Account/ContactPointPhone entirely
    subject: 'בדיקת אינטגרציה אוטומטית — למחוק',
    type: 'Info case',
    language: 'עברית',
    callReceivedAt: new Date().toISOString(),
    openedAt: new Date().toISOString(),
    summary: 'פניה זו נוצרה אוטומטית ע"י scripts/testCreateCase.js לבדיקת האינטגרציה. אפשר למחוק אותה.',
    municipal,
    category: 'General',
    topic: 'General',
  });

  console.log('\n=== Success ===');
  console.log(`Case Id: ${result.id}`);
  console.log(`Case Number: ${result.caseNumber}`);
  console.log('\nOpen it in Salesforce and check:');
  console.log('- OwnerId got a real value (assigned by org automation, since we sent none)');
  console.log('- Category/Topic show "General" correctly');
  console.log('- Origin shows "Phone"');
  console.log('\nThen delete this test case from Salesforce when done.');
}

main().catch((err) => {
  console.error('Test case creation failed:', err.message);
  process.exit(1);
});
