require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const SF_WEB_TO_CASE_URL = 'https://test.salesforce.com/servlet/servlet.WebToCase?encoding=UTF-8';
const SF_OID = process.env.SF_OID || '00DWm000001yNaf';

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limit: max 10 submissions per 15 min per IP
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'יותר מדי בקשות. נסה שוב בעוד מספר דקות.' },
});

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

// POST /api/submit — Web-to-Lead (no auth required)
app.post('/api/submit', submitLimiter, async (req, res) => {
  const { firstName, lastName, email, phone, company, subject, message, rating } = req.body;

  const errors = validateFormData(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  try {
    const priority = { Cold: 'Low', Warm: 'Medium', Hot: 'High' }[rating] || 'Low';

    const params = new URLSearchParams({
      oid: SF_OID,
      retURL: 'https://example.com',
      name: `${firstName.trim()} ${lastName.trim()}`,
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : '',
      subject: subject.trim(),
      description: message.trim(),
      priority,
      type: 'פנייה אנונימית',
    });

    const sfRes = await fetch(SF_WEB_TO_CASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      redirect: 'manual',
    });

    const body = await sfRes.text();
    console.log('SF status:', sfRes.status);
    console.log('SF headers location:', sfRes.headers.get('location'));
    console.log('SF body:', body.slice(0, 2000));

    // Salesforce returns 302 redirect on success
    if (sfRes.status === 302 || sfRes.status === 200) {
      res.json({ success: true });
    } else {
      throw new Error(`Salesforce returned status ${sfRes.status}`);
    }
  } catch (err) {
    console.error('Web-to-Lead error:', err.message);
    res.status(500).json({ success: false, error: 'אירעה שגיאה בשליחת הטופס. אנא נסה שוב.' });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  res.json({ status: 'ok', mode: 'web-to-lead' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Salesforce OID: ${SF_OID} (Web-to-Case)`);
});
