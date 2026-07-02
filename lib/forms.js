'use strict';

/**
 * Pure helpers for the dynamic form builder: slugs, field-key generation,
 * server-side validation against a schema, and building the Salesforce
 * Form_Response__c record. No I/O here so it is easily unit-tested.
 *
 * Schema shape:
 * {
 *   slug, title, description, createdAt,
 *   fields: [{ key, label, type, required, placeholder, help,
 *              options?: string[], mapTo?: 'respondentName'|'email'|'phone'|'subject' }]
 * }
 */

const FIELD_TYPES = [
  'text', 'textarea', 'email', 'phone', 'number', 'date',
  'select', 'radio', 'checkbox', 'checkboxGroup',
];

const CHOICE_TYPES = new Set(['select', 'radio', 'checkboxGroup']);
const MAP_TARGETS = { respondentName: 'Respondent_Name__c', email: 'Email__c', phone: 'Phone__c', subject: 'Subject__c' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function slugify(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9֐-׿]+/g, '-') // keep latin, digits, Hebrew
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'form';
}

// Build a stable, unique key for each field from its label (fallback field_N).
function assignFieldKeys(fields) {
  const seen = new Set();
  return (fields || []).map((f, i) => {
    let base = slugify(f.label).replace(/-/g, '_');
    if (!base || base === 'form') base = `field_${i + 1}`;
    let key = base;
    let n = 2;
    while (seen.has(key)) key = `${base}_${n++}`;
    seen.add(key);
    return { ...f, key };
  });
}

// Normalise + validate a schema coming from the builder. Returns {schema, errors}.
function normalizeSchema(input) {
  const errors = [];
  const title = (input && input.title ? String(input.title) : '').trim();
  if (title.length < 2) errors.push('כותרת הטופס נדרשת (לפחות 2 תווים)');

  let fields = Array.isArray(input && input.fields) ? input.fields : [];
  fields = fields
    .filter((f) => f && String(f.label || '').trim())
    .map((f) => ({
      label: String(f.label).trim(),
      type: FIELD_TYPES.includes(f.type) ? f.type : 'text',
      required: !!f.required,
      placeholder: f.placeholder ? String(f.placeholder) : '',
      help: f.help ? String(f.help) : '',
      options: CHOICE_TYPES.has(f.type)
        ? (Array.isArray(f.options) ? f.options : String(f.options || '').split('\n'))
            .map((o) => String(o).trim()).filter(Boolean)
        : undefined,
      mapTo: MAP_TARGETS[f.mapTo] ? f.mapTo : undefined,
    }));

  if (fields.length === 0) errors.push('יש להוסיף לפחות שדה אחד');
  fields.forEach((f) => {
    if (CHOICE_TYPES.has(f.type) && (!f.options || f.options.length === 0)) {
      errors.push(`לשדה "${f.label}" נדרשת לפחות אפשרות אחת`);
    }
  });

  const schema = { title, description: (input.description || '').toString().trim(), fields: assignFieldKeys(fields) };
  return { schema, errors };
}

function isEmpty(v) {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

// Validate a public submission against the schema. Returns an array of messages.
function validateSubmission(schema, body) {
  const errors = [];
  for (const f of schema.fields) {
    const v = body ? body[f.key] : undefined;
    if (f.required && isEmpty(v)) {
      errors.push(`השדה "${f.label}" נדרש`);
      continue;
    }
    if (isEmpty(v)) continue;

    if (f.type === 'email' && !EMAIL_RE.test(String(v).trim())) {
      errors.push(`"${f.label}": כתובת אימייל לא תקינה`);
    } else if (f.type === 'number' && isNaN(Number(v))) {
      errors.push(`"${f.label}": חייב להיות מספר`);
    } else if (f.type === 'select' || f.type === 'radio') {
      if (f.options && !f.options.includes(String(v))) errors.push(`"${f.label}": ערך לא חוקי`);
    } else if (f.type === 'checkboxGroup') {
      const arr = Array.isArray(v) ? v : [v];
      if (f.options && arr.some((x) => !f.options.includes(String(x)))) errors.push(`"${f.label}": ערך לא חוקי`);
    }
  }
  return errors;
}

// Build the Form_Response__c record from a validated submission.
function buildResponseRecord(schema, body, ip) {
  const answers = {};
  const record = {
    Form_Name__c: schema.title,
    Form_External_Id__c: schema.slug,
    Submitted_At__c: new Date().toISOString(),
    Source_IP__c: (ip || '').slice(0, 45),
  };

  for (const f of schema.fields) {
    let v = body ? body[f.key] : undefined;
    if (isEmpty(v)) continue;
    if (Array.isArray(v)) v = v.join('; ');
    if (typeof v === 'string') v = v.trim();
    answers[f.key] = v;
    if (f.mapTo && MAP_TARGETS[f.mapTo]) {
      record[MAP_TARGETS[f.mapTo]] = String(v).slice(0, 255);
    }
  }
  record.Response_Data__c = JSON.stringify(answers);
  return record;
}

module.exports = {
  FIELD_TYPES, CHOICE_TYPES, MAP_TARGETS,
  slugify, assignFieldKeys, normalizeSchema, validateSubmission, buildResponseRecord,
};
