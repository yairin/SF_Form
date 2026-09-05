const test = require('node:test');
const assert = require('node:assert/strict');

const { validateCasePayload } = require('../src/validation');
const { buildSubject, buildDescription } = require('../src/services/caseService');

test('validateCasePayload rejects an empty payload with every required-field error', () => {
  const errors = validateCasePayload({});
  assert.ok(errors.includes('callId נדרש'));
  assert.ok(errors.includes('municipality (רשות) נדרש'));
  assert.ok(errors.some((e) => e.includes('case.subject')));
  assert.ok(errors.some((e) => e.includes('case.type')));
});

test('validateCasePayload accepts a minimal anonymous payload', () => {
  const errors = validateCasePayload({
    callId: 'c1',
    municipality: 'city-1',
    caller: { anonymous: true },
    case: { subject: 'x', type: 'Info case', description: 'y' },
  });
  assert.deepEqual(errors, []);
});

test('validateCasePayload requires caller/phone fields when not anonymous', () => {
  const errors = validateCasePayload({
    callId: 'c1',
    municipality: 'city-1',
    caller: { anonymous: false },
    case: { subject: 'x', type: 'service case', description: 'y' },
  });
  assert.ok(errors.some((e) => e.includes('idType')));
  assert.ok(errors.some((e) => e.includes('idNumber')));
  assert.ok(errors.some((e) => e.includes('phone.number')));
});

test('validateCasePayload rejects an invalid phone number format', () => {
  const errors = validateCasePayload({
    callId: 'c1',
    municipality: 'city-1',
    caller: { anonymous: false, idType: 'IsraeliID', idNumber: '123', firstName: 'a', lastName: 'b' },
    phone: { number: '123' },
    case: { subject: 'x', type: 'Info case', description: 'y' },
  });
  assert.ok(errors.some((e) => e.includes('phone.number')));
});

test('buildSubject adds the fixed prefix and truncates to 255 chars', () => {
  assert.equal(buildSubject('בור בכביש'), 'פניה טלפונית: בור בכביש');
  const long = 'א'.repeat(300);
  assert.equal(buildSubject(long).length, 255);
});

test('buildDescription includes language/timestamps and truncates the AI summary to 1000 chars', () => {
  const description = buildDescription({
    language: 'עברית',
    callReceivedAt: '2026-01-01T00:00:00Z',
    openedAt: '2026-01-01T00:00:05Z',
    summary: 'x'.repeat(2000),
  });
  assert.ok(description.includes('שפת הפונה: עברית'));
  assert.ok(description.includes('2026-01-01T00:00:00Z'));
  const summaryPart = description.split('\n\n')[1];
  assert.equal(summaryPart.length, 1000);
});
