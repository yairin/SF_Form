require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jsforce = require('jsforce');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'יותר מדי בקשות. נסה שוב בעוד מספר דקות.' },
});

// OAuth2 setup
const oauth2 = new jsforce.OAuth2({
  loginUrl: process.env.SF_LOGIN_URL || 'https://test.salesforce.com',
  clientId: process.env.SF_CLIENT_ID,
  clientSecret: process.env.SF_CLIENT_SECRET,
  redirectUri: process.env.SF_CALLBACK_URL,
});

// Salesforce connection using refresh token
let sfConnection = null;

async function getSFConnection() {
  if (sfConnection) {
    try {
      await sfConnection.identity();
      return sfConnection;
    } catch {
      sfConnection = null;
    }
  }

  if (!process.env.SF_REFRESH_TOKEN) {
    throw new Error('SF_REFRESH_TOKEN not set — visit /auth to authorize');
  }

  const conn = new jsforce.Connection({
    oauth2,
    instanceUrl: process.env.SF_INSTANCE_URL,
    accessToken: '',
    refreshToken: process.env.SF_REFRESH_TOKEN,
  });

  conn.on('refresh', (accessToken) => {
    console.log('SF token refreshed');
  });

  await conn.identity();
  sfConnection = conn;
  return conn;
}

// ── OAuth2 authorization flow (one-time setup) ────────────────────────────────

// Step 1: Redirect admin to Salesforce login
app.get('/auth', (req, res) => {
  const url = oauth2.getAuthorizationUrl({ scope: 'api refresh_token offline_access' });
  console.log('Auth URL:', url);
  console.log('Callback URL env:', process.env.SF_CALLBACK_URL);
  res.redirect(url);
});

// Step 2: Salesforce redirects back with code
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');

  try {
    const conn = new jsforce.Connection({ oauth2 });
    await conn.authorize(code);

    res.send(`
      <html><body style="font-family:sans-serif;direction:rtl;padding:32px">
        <h2>✅ אישור הצליח!</h2>
        <p>הוסף את המשתנים הבאים ב-Railway:</p>
        <pre style="background:#f0f0f0;padding:16px;border-radius:8px">
SF_REFRESH_TOKEN=${conn.refreshToken}
SF_INSTANCE_URL=${conn.instanceUrl}
        </pre>
        <p>לאחר הוספה, בצע Redeploy ב-Railway.</p>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send(`שגיאה: ${err.message}`);
  }
});

// ── Validation ─────────────────────────────────────────────────────────────────

function validateFormData(data) {
  const errors = [];
  if (!data.firstName || data.firstName.trim().length < 2) errors.push('שם פרטי נדרש (לפחות 2 תווים)');
  if (!data.lastName || data.lastName.trim().length < 2) errors.push('שם משפחה נדרש (לפחות 2 תווים)');
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('כתובת אימייל לא תקינה');
  if (!data.subject || data.subject.trim().length < 3) errors.push('נושא נדרש');
  if (!data.message || data.message.trim().length < 10) errors.push('הודעה נדרשת (לפחות 10 תווים)');
  return errors;
}

// ── Submit ─────────────────────────────────────────────────────────────────────

app.post('/api/submit', submitLimiter, async (req, res) => {
  const { firstName, lastName, email, phone, company, subject, message, rating } = req.body;

  const errors = validateFormData(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  try {
    const conn = await getSFConnection();
    const objectName = process.env.SF_OBJECT || 'Case';

    const record = objectName === 'Case' ? {
      SuppliedName: `${firstName.trim()} ${lastName.trim()}`,
      SuppliedEmail: email.trim().toLowerCase(),
      SuppliedPhone: phone ? phone.trim() : undefined,
      SuppliedCompany: company ? company.trim() : 'אנונימי',
      Subject: subject.trim(),
      Description: message.trim(),
      Priority: { Cold: 'Low', Warm: 'Medium', Hot: 'High' }[rating] || 'Low',
      Origin: 'Web',
      Status: 'New',
    } : {
      // Custom object — field names from SF_FIELD_MAP env var (JSON)
      ...buildCustomRecord(req.body),
    };

    // Remove undefined
    Object.keys(record).forEach((k) => record[k] === undefined && delete record[k]);

    const result = await conn.sobject(objectName).create(record);
    if (result.success) {
      res.json({ success: true, id: result.id });
    } else {
      throw new Error(result.errors?.join(', '));
    }
  } catch (err) {
    console.error('Salesforce error:', err.message);
    if (err.errorCode === 'INVALID_SESSION_ID') sfConnection = null;
    res.status(500).json({ success: false, error: 'אירעה שגיאה בשליחת הטופס. אנא נסה שוב.' });
  }
});

function buildCustomRecord({ firstName, lastName, email, phone, company, subject, message, rating }) {
  try {
    const map = JSON.parse(process.env.SF_FIELD_MAP || '{}');
    const data = { firstName, lastName, email, phone, company, subject, message, rating };
    const record = {};
    Object.entries(map).forEach(([sfField, formField]) => {
      if (data[formField] !== undefined) record[sfField] = data[formField];
    });
    return record;
  } catch {
    return {};
  }
}

// ── Health ─────────────────────────────────────────────────────────────────────

app.get('/api/health', async (req, res) => {
  if (!process.env.SF_REFRESH_TOKEN) {
    return res.status(503).json({ status: 'setup_required', message: 'Visit /auth to authorize Salesforce' });
  }
  try {
    await getSFConnection();
    res.json({ status: 'ok', salesforce: 'connected', object: process.env.SF_OBJECT || 'Case' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', salesforce: 'disconnected', error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
