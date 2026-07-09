'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const store = require('./src/store');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

// הגבלת קצב על נתיבי התחברות (הגנה מפני ניחוש PIN).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'יותר מדי ניסיונות. נסה שוב בעוד מספר דקות.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/setup', authLimiter);

// נתיבי ה-API.
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/tasks', require('./src/routes/tasks'));
app.use('/api/allowance', require('./src/routes/allowance'));
app.use('/api/shopping', require('./src/routes/shopping'));
app.use('/api/surveys', require('./src/routes/surveys'));
app.use('/api/summary', require('./src/routes/summary'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', storage: store.kind });
});

// קבצים סטטיים (הפרונט).
app.use(express.static(path.join(__dirname, 'public')));

// כל נתיב שאינו API מוגש כאפליקציה (SPA).
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// מטפל שגיאות כללי.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'אירעה שגיאה בשרת' });
});

async function main() {
  await store.init();
  app.listen(PORT, () => {
    console.log(`בית אחד — השרת פועל על http://localhost:${PORT} (אחסון: ${store.kind})`);
  });
}

main().catch((err) => {
  console.error('כשל באתחול השרת:', err);
  process.exit(1);
});
