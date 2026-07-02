require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const jsforce = require('jsforce');
const forms = require('./lib/forms');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_TEST = process.env.NODE_ENV === 'test';

const SF_LOGIN_URL = process.env.SF_LOGIN_URL || 'https://test.salesforce.com';
const FORM_NAME = 'טופס פתיחת פנייה';
const FORM_EXTERNAL_ID = 'contact-inquiry';

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_TEST ? 100000 : 10,
  message: { success: false, error: 'יותר מדי בקשות. נסה שוב בעוד מספר דקות.' },
});

// ── Salesforce connection (jsforce, cached with re-login on expiry) ───────────
let cachedConn = null;

async function getConnection() {
  if (cachedConn) return cachedConn;
  const { SF_USERNAME, SF_PASSWORD, SF_SECURITY_TOKEN } = process.env;
  if (!SF_USERNAME || !SF_PASSWORD) {
    throw new Error('Missing Salesforce credentials (SF_USERNAME / SF_PASSWORD)');
  }
  const conn = new jsforce.Connection({ loginUrl: SF_LOGIN_URL });
  await conn.login(SF_USERNAME, `${SF_PASSWORD}${SF_SECURITY_TOKEN || ''}`);
  cachedConn = conn;
  return conn;
}

// Connection provider is overridable so tests can inject a fake connection.
let connectionProvider = getConnection;
function setConnectionProvider(fn) {
  connectionProvider = fn;
  cachedConn = null;
}

// Run a callback with a live connection; on an expired/invalid session, reset and retry once.
async function withConnection(fn) {
  try {
    return await fn(await connectionProvider());
  } catch (err) {
    if (cachedConn && /INVALID_SESSION|expired|not logged in|INVALID_LOGIN/i.test(err.message || '')) {
      cachedConn = null;
      return await fn(await connectionProvider());
    }
    throw err;
  }
}

// ── Pure helpers (exported for tests) ─────────────────────────────────────────
function validateFormData(data) {
  const errors = [];
  if (!data.firstName || data.firstName.trim().length < 2) errors.push('שם פרטי נדרש (לפחות 2 תווים)');
  if (!data.lastName || data.lastName.trim().length < 2) errors.push('שם משפחה נדרש (לפחות 2 תווים)');
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('כתובת אימייל לא תקינה');
  if (!data.subject || data.subject.trim().length < 3) errors.push('נושא נדרש');
  if (!data.message || data.message.trim().length < 10) errors.push('הודעה נדרשת (לפחות 10 תווים)');
  return errors;
}

const RATING_LABELS = { Cold: 'רגיל', Warm: 'בינוני', Hot: 'דחוף' };

// Full answer set stored as JSON in Response_Data__c (flattened into
// Form_Answer__c rows by the after-insert Apex trigger in Salesforce).
function buildAnswers(data) {
  return {
    firstName: (data.firstName || '').trim(),
    lastName: (data.lastName || '').trim(),
    email: (data.email || '').trim().toLowerCase(),
    phone: data.phone ? data.phone.trim() : '',
    company: data.company ? data.company.trim() : '',
    subject: (data.subject || '').trim(),
    message: (data.message || '').trim(),
    urgency: RATING_LABELS[data.rating] || 'רגיל',
  };
}

function buildRecord(data, ip) {
  const answers = buildAnswers(data);
  return {
    Form_Name__c: FORM_NAME,
    Form_External_Id__c: FORM_EXTERNAL_ID,
    Submitted_At__c: new Date().toISOString(),
    Respondent_Name__c: `${answers.firstName} ${answers.lastName}`.slice(0, 255),
    Email__c: answers.email,
    Phone__c: answers.phone,
    Subject__c: answers.subject.slice(0, 255),
    Response_Data__c: JSON.stringify(answers),
    Source_IP__c: (ip || '').slice(0, 45),
  };
}

// ── Submit → create a Form_Response__c record ─────────────────────────────────
app.post('/api/submit', submitLimiter, async (req, res) => {
  const errors = validateFormData(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  const record = buildRecord(req.body, req.ip);

  try {
    const result = await withConnection((conn) =>
      conn.sobject('Form_Response__c').create(record)
    );
    if (!result.success) {
      throw new Error(`Create failed: ${JSON.stringify(result.errors || result)}`);
    }

    // Return the friendly auto-number (FR-00001) when available, else the record Id.
    let reference = result.id;
    try {
      const created = await withConnection((conn) =>
        conn.sobject('Form_Response__c').retrieve(result.id)
      );
      if (created && created.Name) reference = created.Name;
    } catch (_) {
      /* non-fatal: fall back to the record Id */
    }

    console.log('Form_Response__c created:', reference);
    res.json({ success: true, id: reference });
  } catch (err) {
    console.error('Submit error:', err.message);
    res.status(500).json({ success: false, error: 'אירעה שגיאה בשליחת הטופס. אנא נסה שוב.' });
  }
});

// ── Health check (verifies the Salesforce connection) ─────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const conn = await connectionProvider();
    const identity = await conn.identity();
    res.json({
      status: 'ok',
      mode: 'jsforce',
      object: 'Form_Response__c',
      org: identity.organization_id,
      user: identity.username,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// ── Dynamic form builder ──────────────────────────────────────────────────────
const FORMS_DIR = process.env.FORMS_DIR || path.join(__dirname, 'data', 'forms');
fs.mkdirSync(FORMS_DIR, { recursive: true });

const formPath = (slug) => path.join(FORMS_DIR, `${slug}.json`);
const formExists = (slug) => fs.existsSync(formPath(slug));
function readForm(slug) {
  try { return JSON.parse(fs.readFileSync(formPath(slug), 'utf8')); } catch { return null; }
}
function listForms() {
  return fs.readdirSync(FORMS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readForm(f.slice(0, -5)))
    .filter(Boolean)
    .map((s) => ({ slug: s.slug, title: s.title, fields: s.fields.length, createdAt: s.createdAt }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
function uniqueSlug(base) {
  let slug = base, n = 2;
  while (formExists(slug)) slug = `${base}-${n++}`;
  return slug;
}

// Builder: create a form
app.post('/api/forms', (req, res) => {
  const { schema, errors } = forms.normalizeSchema(req.body || {});
  if (errors.length) return res.status(400).json({ success: false, errors });
  schema.slug = uniqueSlug(forms.slugify(schema.title));
  schema.createdAt = new Date().toISOString();
  fs.writeFileSync(formPath(schema.slug), JSON.stringify(schema, null, 2));
  res.json({ success: true, slug: schema.slug, url: `/f/${schema.slug}` });
});

// Builder: list forms
app.get('/api/forms', (req, res) => res.json({ forms: listForms() }));

// Public: fetch a form schema for rendering
app.get('/api/forms/:slug', (req, res) => {
  const schema = readForm(req.params.slug);
  if (!schema) return res.status(404).json({ error: 'Form not found' });
  res.json(schema);
});

// Public anonymous submission → Form_Response__c
app.post('/api/forms/:slug/submit', submitLimiter, async (req, res) => {
  if (req.body && req.body._hp) return res.json({ success: true, id: 'ok' }); // honeypot
  const schema = readForm(req.params.slug);
  if (!schema) return res.status(404).json({ success: false, error: 'הטופס לא נמצא' });

  const errors = forms.validateSubmission(schema, req.body || {});
  if (errors.length) return res.status(400).json({ success: false, errors });

  const record = forms.buildResponseRecord(schema, req.body || {}, req.ip);
  try {
    const result = await withConnection((conn) => conn.sobject('Form_Response__c').create(record));
    if (!result.success) throw new Error(`Create failed: ${JSON.stringify(result.errors || result)}`);
    let reference = result.id;
    try {
      const created = await withConnection((conn) => conn.sobject('Form_Response__c').retrieve(result.id));
      if (created && created.Name) reference = created.Name;
    } catch (_) { /* fall back to record Id */ }
    res.json({ success: true, id: reference });
  } catch (err) {
    console.error('Form submit error:', err.message);
    res.status(500).json({ success: false, error: 'אירעה שגיאה בשליחת הטופס. אנא נסה שוב.' });
  }
});

// Pages
app.get('/builder', (req, res) => res.sendFile(path.join(__dirname, 'public', 'builder.html')));
app.get('/f/:slug', (req, res) => res.sendFile(path.join(__dirname, 'public', 'form.html')));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = { app, validateFormData, buildAnswers, buildRecord, setConnectionProvider };
