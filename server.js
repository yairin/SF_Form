require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jsforce = require('jsforce');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limit: max 10 submissions per 15 min per IP
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'יותר מדי בקשות. נסה שוב בעוד מספר דקות.' },
});

// Salesforce connection (singleton with auto-reconnect)
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

  const conn = new jsforce.Connection({
    loginUrl: process.env.SF_LOGIN_URL || 'https://test.salesforce.com',
  });

  await conn.login(
    process.env.SF_USERNAME,
    process.env.SF_PASSWORD + (process.env.SF_SECURITY_TOKEN || '')
  );

  sfConnection = conn;
  return conn;
}

// Validate form input
function validateFormData(data) {
  const errors = [];
  if (!data.firstName || data.firstName.trim().length < 2) errors.push('שם פרטי נדרש (לפחות 2 תווים)');
  if (!data.lastName || data.lastName.trim().length < 2) errors.push('שם משפחה נדרש (לפחות 2 תווים)');
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('כתובת אימייל לא תקינה');
  if (!data.subject || data.subject.trim().length < 3) errors.push('נושא נדרש');
  if (!data.message || data.message.trim().length < 10) errors.push('הודעה נדרשת (לפחות 10 תווים)');
  return errors;
}

// POST /api/submit — create Lead in Salesforce
app.post('/api/submit', submitLimiter, async (req, res) => {
  const { firstName, lastName, email, phone, company, subject, message, rating } = req.body;

  const errors = validateFormData(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  try {
    const conn = await getSFConnection();

    const lead = {
      FirstName: firstName.trim(),
      LastName: lastName.trim(),
      Email: email.trim().toLowerCase(),
      Phone: phone ? phone.trim() : undefined,
      Company: company ? company.trim() : 'אנונימי',
      LeadSource: 'Web',
      Subject__c: subject.trim(),       // Custom field — or use Description
      Description: `נושא: ${subject.trim()}\n\nהודעה:\n${message.trim()}`,
      Rating: rating || 'Cold',
      Status: 'Open - Not Contacted',
    };

    // Remove undefined fields
    Object.keys(lead).forEach((k) => lead[k] === undefined && delete lead[k]);

    const result = await conn.sobject('Lead').create(lead);

    if (result.success) {
      res.json({ success: true, id: result.id });
    } else {
      throw new Error(result.errors?.join(', ') || 'שגיאה ביצירת הרשומה');
    }
  } catch (err) {
    console.error('Salesforce error:', err.message);

    // Reset connection on auth errors
    if (err.errorCode === 'INVALID_SESSION_ID') {
      sfConnection = null;
    }

    res.status(500).json({
      success: false,
      error: 'אירעה שגיאה בשליחת הטופס. אנא נסה שוב.',
    });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await getSFConnection();
    res.json({ status: 'ok', salesforce: 'connected' });
  } catch {
    res.status(503).json({ status: 'degraded', salesforce: 'disconnected' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Salesforce URL: ${process.env.SF_LOGIN_URL || 'https://test.salesforce.com'}`);
});
