'use strict';

process.env.NODE_ENV = 'test';
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
// Isolate the form store to a temp dir (must be set before requiring the server).
process.env.FORMS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sfforms-'));

const test = require('node:test');
const assert = require('node:assert');
const { app, setConnectionProvider } = require('../server');

let server, base, created;

test.before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  setConnectionProvider(async () => ({
    sobject: () => ({
      create: async (rec) => { created = rec; return { success: true, id: '001XXXXXXXXXXXXAAA' }; },
      retrieve: async () => ({ Name: 'FR-00007' }),
    }),
  }));
});

test.after(() => { if (server) server.close(); });

const j = (method, url, body) => fetch(base + url, {
  method, headers: { 'Content-Type': 'application/json' },
  body: body ? JSON.stringify(body) : undefined,
});

const sampleForm = {
  title: 'רישום לאירוע',
  description: 'טופס בדיקה',
  fields: [
    { label: 'שם מלא', type: 'text', required: true, mapTo: 'respondentName' },
    { label: 'אימייל', type: 'email', required: true, mapTo: 'email' },
    { label: 'מסלול', type: 'select', required: true, options: ['בוקר', 'ערב'] },
  ],
};

let slug;

test('POST /api/forms creates a form and returns a slug + url', async () => {
  const res = await j('POST', '/api/forms', sampleForm);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.success, true);
  assert.ok(data.slug);
  assert.equal(data.url, `/f/${data.slug}`);
  slug = data.slug;
});

test('POST /api/forms rejects invalid schema (no title)', async () => {
  const res = await j('POST', '/api/forms', { title: '', fields: [] });
  const data = await res.json();
  assert.equal(res.status, 400);
  assert.ok(data.errors.length >= 1);
});

test('GET /api/forms lists the created form', async () => {
  const { forms: list } = await (await fetch(base + '/api/forms')).json();
  assert.ok(list.some((f) => f.slug === slug));
});

test('GET /api/forms/:slug returns schema with generated keys', async () => {
  const schema = await (await fetch(`${base}/api/forms/${slug}`)).json();
  assert.equal(schema.fields.length, 3);
  assert.ok(schema.fields.every((f) => typeof f.key === 'string' && f.key.length));
});

test('GET /api/forms/:slug 404 for unknown form', async () => {
  const res = await fetch(`${base}/api/forms/does-not-exist`);
  assert.equal(res.status, 404);
});

test('POST submit: valid submission creates Form_Response__c and returns FR- reference', async () => {
  const schema = await (await fetch(`${base}/api/forms/${slug}`)).json();
  const [nameKey, emailKey, trackKey] = schema.fields.map((f) => f.key);
  created = null;
  const res = await j('POST', `/api/forms/${slug}/submit`, {
    [nameKey]: 'ישראל ישראלי', [emailKey]: 'israel@example.com', [trackKey]: 'בוקר',
  });
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.id, 'FR-00007');
  assert.equal(created.Respondent_Name__c, 'ישראל ישראלי');
  assert.equal(created.Email__c, 'israel@example.com');
  assert.equal(JSON.parse(created.Response_Data__c)[trackKey], 'בוקר');
});

test('POST submit: missing required field returns 400', async () => {
  const res = await j('POST', `/api/forms/${slug}/submit`, {});
  const data = await res.json();
  assert.equal(res.status, 400);
  assert.ok(data.errors.length >= 1);
});

test('POST submit: honeypot silently succeeds without creating a record', async () => {
  created = null;
  const res = await j('POST', `/api/forms/${slug}/submit`, { _hp: 'i-am-a-bot' });
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(created, null, 'no record created for honeypot');
});
