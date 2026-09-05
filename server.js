require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRouter = require('./src/routes/auth');
const casesRouter = require('./src/routes/cases');

const app = express();
const PORT = process.env.PORT || 3000;
const SF_OID = '00DWm000001yNaf';
const SF_WEB_TO_LEAD = 'https://test.salesforce.com/servlet/servlet.WebToLead?encoding=UTF-8';

app.set('trust proxy', 1);
app.use(cors());
// Higher limit than the default 100kb: the AI case-opening API can carry a base64
// call recording. Prefer attachments.recordingUrl over recordingBase64 where possible.
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const aiApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { success: false, error: 'Too many requests', code: 'RATE_LIMITED' },
});

app.use('/oauth', aiApiLimiter, authRouter);
app.use('/api/cases', aiApiLimiter, casesRouter);

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'יותר מדי בקשות. נסה שוב בעוד מספר דקות.' },
});

function validateFormData(data) {
  const errors = [];
  if (!data.firstName || data.firstName.trim().length < 2) errors.push('שם פרטי נדרש (לפחות 2 תווים)');
  if (!data.lastName || data.lastName.trim().length < 2) errors.push('שם משפחה נדרש (לפחות 2 תווים)');
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('כתובת אימייל לא תקינה');
  if (!data.subject || data.subject.trim().length < 3) errors.push('נושא נדרש');
  if (!data.message || data.message.trim().length < 10) errors.push('הודעה נדרשת (לפחות 10 תווים)');
  return errors;
}

app.post('/api/submit', submitLimiter, async (req, res) => {
  const { firstName, lastName, email, phone, company, subject, message, rating } = req.body;

  const errors = validateFormData(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  try {
    const ratingLabel = { Cold: 'רגיל', Warm: 'בינוני', Hot: 'דחוף' }[rating] || 'רגיל';

    const params = new URLSearchParams({
      oid: SF_OID,
      retURL: 'https://sfform-production.up.railway.app',
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : '',
      company: company ? company.trim() : 'אנונימי',
      lead_source: 'Web',
      description: `נושא: ${subject.trim()}\nדחיפות: ${ratingLabel}\n\n${message.trim()}`,
    });

    const sfRes = await fetch(SF_WEB_TO_LEAD, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      redirect: 'manual',
    });

    const sfBody = await sfRes.text();
    console.log('SF response status:', sfRes.status);
    console.log('SF response location:', sfRes.headers.get('location'));
    console.log('SF response body (first 500):', sfBody.slice(0, 500));

    if (sfRes.status === 302 || sfRes.status === 200) {
      const location = sfRes.headers.get('location') || '';
      const isError = sfBody.includes('error') || sfBody.includes('Error') || location.includes('error');
      if (isError) {
        console.error('SF returned error in body/redirect:', location || sfBody.slice(0, 200));
        throw new Error('Salesforce rejected the submission');
      }
      console.log('Lead submitted successfully');
      res.json({ success: true });
    } else {
      throw new Error(`SF status ${sfRes.status}`);
    }
  } catch (err) {
    console.error('Submit error:', err.message);
    res.status(500).json({ success: false, error: 'אירעה שגיאה בשליחת הטופס. אנא נסה שוב.' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: 'web-to-lead', oid: SF_OID });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
