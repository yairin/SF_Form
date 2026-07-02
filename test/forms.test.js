'use strict';

const test = require('node:test');
const assert = require('node:assert');
const forms = require('../lib/forms');

const schema = {
  slug: 'event-reg',
  title: 'רישום לאירוע',
  fields: [
    { key: 'full_name', label: 'שם מלא', type: 'text', required: true, mapTo: 'respondentName' },
    { key: 'email', label: 'אימייל', type: 'email', required: true, mapTo: 'email' },
    { key: 'track', label: 'מסלול', type: 'select', required: true, options: ['בוקר', 'ערב'] },
    { key: 'topics', label: 'נושאים', type: 'checkboxGroup', required: false, options: ['הסעות', 'קייטרינג'] },
  ],
};

test('normalizeSchema: assigns unique keys and flags errors', () => {
  const { schema: s, errors } = forms.normalizeSchema({
    title: 'סקר',
    fields: [
      { label: 'שם', type: 'text' },
      { label: 'שם', type: 'text' },              // duplicate label -> unique key
      { label: 'בחירה', type: 'select', options: 'א\nב' },
    ],
  });
  assert.equal(errors.length, 0);
  const keys = s.fields.map((f) => f.key);
  assert.equal(new Set(keys).size, keys.length, 'keys are unique');
  assert.deepEqual(s.fields[2].options, ['א', 'ב']);
});

test('normalizeSchema: rejects empty title / no fields / choice without options', () => {
  assert.ok(forms.normalizeSchema({ title: '', fields: [] }).errors.length >= 2);
  const e = forms.normalizeSchema({ title: 'x', fields: [{ label: 'בחר', type: 'radio', options: [] }] }).errors;
  assert.ok(e.some((m) => m.includes('אפשרות')));
});

test('validateSubmission: required + type checks', () => {
  assert.deepEqual(forms.validateSubmission(schema, {
    full_name: 'ישראל', email: 'a@b.com', track: 'בוקר',
  }), []);

  const errs = forms.validateSubmission(schema, { email: 'bad', track: 'לא-קיים' });
  assert.ok(errs.some((m) => m.includes('שם מלא')));   // required missing
  assert.ok(errs.some((m) => m.includes('אימייל')));    // bad email
  assert.ok(errs.some((m) => m.includes('מסלול')));     // value not in options
});

test('validateSubmission: rejects out-of-list multi-select value', () => {
  const errs = forms.validateSubmission(schema, {
    full_name: 'x', email: 'a@b.com', track: 'בוקר', topics: ['הסעות', 'זבל'],
  });
  assert.ok(errs.some((m) => m.includes('נושאים')));
});

test('buildResponseRecord: maps key fields + JSON payload, joins multi-select', () => {
  const rec = forms.buildResponseRecord(schema, {
    full_name: 'ישראל ישראלי', email: 'A@B.com', track: 'בוקר', topics: ['הסעות', 'קייטרינג'],
  }, '9.9.9.9');
  assert.equal(rec.Form_Name__c, 'רישום לאירוע');
  assert.equal(rec.Form_External_Id__c, 'event-reg');
  assert.equal(rec.Respondent_Name__c, 'ישראל ישראלי');
  assert.equal(rec.Email__c, 'A@B.com');
  assert.equal(rec.Source_IP__c, '9.9.9.9');
  const data = JSON.parse(rec.Response_Data__c);
  assert.equal(data.track, 'בוקר');
  assert.equal(data.topics, 'הסעות; קייטרינג');
});

test('slugify: latin + hebrew, trims junk', () => {
  assert.equal(forms.slugify('Event Registration!!'), 'event-registration');
  assert.equal(forms.slugify('  '), 'form');
});
