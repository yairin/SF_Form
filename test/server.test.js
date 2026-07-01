'use strict';

// Must be set before requiring the server (it configures the rate limiter at load).
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert');
const {
  app,
  validateFormData,
  buildAnswers,
  buildRecord,
  setConnectionProvider,
} = require('../server');

let server;
let base;

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  if (server) server.close();
});

// Fake jsforce connection used to isolate the app from Salesforce.
function fakeConn(overrides = {}) {
  return {
    sobject: () => ({
      create: overrides.create || (async () => ({ success: true, id: '001XXXXXXXXXXXXAAA' })),
      retrieve: overrides.retrieve || (async () => ({ Name: 'FR-00001' })),
    }),
    identity:
      overrides.identity ||
      (async () => ({ organization_id: '00DXXXXXXXXXXXXXXX', username: 'admin@example.com' })),
  };
}

const validBody = {
  firstName: 'ישראל',
  lastName: 'ישראלי',
  email: 'A@Example.com',
  phone: '050-1234567',
  company: 'Acme',
  subject: 'בקשת מידע',
  message: 'זהו תוכן הפנייה המפורט',
  rating: 'Warm',
};

function postSubmit(body) {
  return fetch(`${base}/api/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Pure helpers ──────────────────────────────────────────────────────────────
test('validateFormData: valid input has no errors', () => {
  assert.deepEqual(validateFormData(validBody), []);
});

test('validateFormData: catches short/invalid fields', () => {
  const errs = validateFormData({ firstName: 'א', lastName: '', email: 'bad', subject: '', message: 'short' });
  assert.ok(errs.length >= 4, `expected >=4 errors, got ${errs.length}`);
});

test('buildAnswers: trims, lowercases email, maps urgency label', () => {
  const a = buildAnswers(validBody);
  assert.equal(a.email, 'a@example.com');
  assert.equal(a.urgency, 'בינוני');
  assert.equal(a.company, 'Acme');
});

test('buildRecord: maps key fields and JSON payload', () => {
  const r = buildRecord(validBody, '1.2.3.4');
  assert.equal(r.Form_Name__c, 'טופס פתיחת פנייה');
  assert.equal(r.Respondent_Name__c, 'ישראל ישראלי');
  assert.equal(r.Email__c, 'a@example.com');
  assert.equal(r.Subject__c, 'בקשת מידע');
  assert.equal(r.Source_IP__c, '1.2.3.4');
  const parsed = JSON.parse(r.Response_Data__c);
  assert.equal(parsed.message, 'זהו תוכן הפנייה המפורט');
  assert.equal(parsed.urgency, 'בינוני');
});

// ── HTTP routes ─────────────────────────────────────────────────────────────
test('POST /api/submit: success returns friendly reference (FR-...)', async () => {
  setConnectionProvider(async () => fakeConn());
  const res = await postSubmit(validBody);
  const json = await res.json();
  assert.equal(res.status, 200);
  assert.equal(json.success, true);
  assert.equal(json.id, 'FR-00001');
});

test('POST /api/submit: falls back to record Id when Name is missing', async () => {
  setConnectionProvider(async () => fakeConn({ retrieve: async () => ({}) }));
  const res = await postSubmit(validBody);
  const json = await res.json();
  assert.equal(json.id, '001XXXXXXXXXXXXAAA');
});

test('POST /api/submit: validation error returns 400', async () => {
  const res = await postSubmit({ email: 'bad' });
  const json = await res.json();
  assert.equal(res.status, 400);
  assert.equal(json.success, false);
  assert.ok(Array.isArray(json.errors) && json.errors.length > 0);
});

test('POST /api/submit: Salesforce create failure returns 500', async () => {
  setConnectionProvider(async () => fakeConn({ create: async () => ({ success: false, errors: ['DUPLICATE'] }) }));
  const res = await postSubmit(validBody);
  const json = await res.json();
  assert.equal(res.status, 500);
  assert.equal(json.success, false);
});

test('GET /api/health: reports ok with org identity', async () => {
  setConnectionProvider(async () => fakeConn());
  const res = await fetch(`${base}/api/health`);
  const json = await res.json();
  assert.equal(json.status, 'ok');
  assert.equal(json.mode, 'jsforce');
  assert.equal(json.org, '00DXXXXXXXXXXXXXXX');
});

test('GET /api/health: reports error when connection fails', async () => {
  setConnectionProvider(async () => {
    throw new Error('Missing Salesforce credentials (SF_USERNAME / SF_PASSWORD)');
  });
  const res = await fetch(`${base}/api/health`);
  const json = await res.json();
  assert.equal(res.status, 500);
  assert.equal(json.status, 'error');
});
