require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { createEmergencyEvent, checkConnection } = require('./sf-emergency');

const app = express();
const PORT = process.env.PORT || 3000;
const SF_OID = '00DWm000001yNaf';
const SF_WEB_TO_LEAD = 'https://test.salesforce.com/servlet/servlet.WebToLead?encoding=UTF-8';

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// ── Emergency event ───────────────────────────────────────────────────────
const EVENT_TYPES = ['שריפה', 'רעידת אדמה', 'שיטפון', 'אירוע ביטחוני', 'תאונה', 'מפגע', 'אחר'];
const SEVERITIES = ['נמוכה', 'בינונית', 'גבוהה', 'קריטית'];

function validateEmergencyData(data) {
  const errors = [];
  if (!data.title || data.title.trim().length < 3) errors.push('כותרת האירוע נדרשת (לפחות 3 תווים)');
  if (!data.type || !EVENT_TYPES.includes(data.type)) errors.push('סוג אירוע לא תקין');
  if (!data.severity || !SEVERITIES.includes(data.severity)) errors.push('דרגת חומרה לא תקינה');
  if (!data.location || data.location.trim().length < 2) errors.push('מיקום האירוע נדרש');
  if (!data.description || data.description.trim().length < 10) errors.push('תיאור האירוע נדרש (לפחות 10 תווים)');
  if (!data.reporter || data.reporter.trim().length < 2) errors.push('שם המדווח נדרש');
  if (!data.phone || !/^[\d\-+()\s]{7,20}$/.test(data.phone.trim())) errors.push('מספר טלפון לא תקין');
  if (data.casualties !== undefined && data.casualties !== null && data.casualties !== '') {
    const n = Number(data.casualties);
    if (!Number.isInteger(n) || n < 0) errors.push('מספר נפגעים חייב להיות מספר שלם אי-שלילי');
  }
  return errors;
}

app.post('/api/emergency', submitLimiter, async (req, res) => {
  const errors = validateEmergencyData(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  try {
    const { id } = await createEmergencyEvent(req.body);
    console.log('Emergency event created:', id);
    res.json({ success: true, id });
  } catch (err) {
    console.error('Emergency submit error:', err.message);
    res.status(500).json({ success: false, error: 'אירעה שגיאה בהקמת האירוע. אנא נסה שוב.' });
  }
});

app.get('/api/emergency/health', async (req, res) => {
  try {
    const info = await checkConnection();
    res.json({ status: 'ok', mode: 'jsforce', ...info });
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: 'web-to-lead', oid: SF_OID });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
