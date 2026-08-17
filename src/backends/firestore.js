'use strict';

/**
 * Backend מבוסס Cloud Firestore (Firebase).
 * שומר כל "אוסף" (collection) כמסמך יחיד תחת אוסף השורש `bait_echad`,
 * כשהמסמך מחזיק מערך רשומות בשדה `data`. מתאים היטב לנפח נתונים משפחתי.
 *
 * הרשאות (credentials) נטענות אוטומטית ב-Cloud Run / Cloud Functions.
 * מקומית: הגדר GOOGLE_APPLICATION_CREDENTIALS לקובץ service account,
 * או FIREBASE_SERVICE_ACCOUNT עם תוכן ה-JSON.
 */

const admin = require('firebase-admin');

const ROOT = 'bait_echad';
let db = null;

function getDb() {
  if (db) return db;
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (raw) {
      const creds = JSON.parse(raw);
      admin.initializeApp({
        credential: admin.credential.cert(creds),
        projectId: creds.project_id || process.env.FIREBASE_PROJECT_ID,
      });
    } else {
      // Application Default Credentials (Cloud Run / Functions / GOOGLE_APPLICATION_CREDENTIALS)
      admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
    }
  }
  db = admin.firestore();
  return db;
}

module.exports = {
  kind: 'firestore',

  async init() {
    // גישה ראשונית כדי לאמת חיבור/הרשאות מוקדם ככל האפשר.
    getDb();
  },

  async loadCollection(name) {
    const snap = await getDb().collection(ROOT).doc(name).get();
    if (!snap.exists) return [];
    const data = snap.data();
    return Array.isArray(data && data.data) ? data.data : [];
  },

  async saveCollection(name, rows) {
    await getDb().collection(ROOT).doc(name).set({ data: rows, updatedAt: Date.now() });
  },

  async close() {
    /* firebase-admin מנהל את החיבור בעצמו */
  },
};
