'use strict';

/**
 * שכבת נתונים ברמה גבוהה ("בית אחד").
 * בוחרת backend לפי משתני הסביבה:
 *   - אם קיים DATABASE_URL → Postgres (ענן)
 *   - אחרת → קובץ JSON מקומי
 * הלוגיקה העסקית זהה בשני המקרים; ה-backend רק טוען/שומר אוספים.
 */

const crypto = require('crypto');

function selectBackend() {
  // עדיפות: Firestore (Firebase) → Postgres → קובץ JSON מקומי.
  if (process.env.USE_FIRESTORE === 'true' || process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_SERVICE_ACCOUNT) {
    return require('./backends/firestore');
  }
  if (process.env.DATABASE_URL) {
    return require('./backends/pg');
  }
  return require('./backends/json');
}

const backend = selectBackend();

// מנעול כתיבה גלובלי — מבטיח שפעולות load-modify-save לא ירוצו במקביל וידרסו זו את זו.
let writeChain = Promise.resolve();
function withLock(fn) {
  const run = writeChain.then(fn, fn);
  // שומרים על השרשרת גם אם הפעולה נכשלה, בלי לזרוק כאן.
  writeChain = run.then(() => {}, () => {});
  return run;
}

function id() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

// ---- עזרי אוסף גנריים ----

async function all(name) {
  return backend.loadCollection(name);
}

async function insert(name, row) {
  return withLock(async () => {
    const rows = await backend.loadCollection(name);
    const record = { id: id(), createdAt: nowIso(), ...row };
    rows.push(record);
    await backend.saveCollection(name, rows);
    return record;
  });
}

async function update(name, recordId, patch) {
  return withLock(async () => {
    const rows = await backend.loadCollection(name);
    const idx = rows.findIndex((r) => r.id === recordId);
    if (idx === -1) return null;
    rows[idx] = { ...rows[idx], ...patch, updatedAt: nowIso() };
    await backend.saveCollection(name, rows);
    return rows[idx];
  });
}

async function remove(name, recordId) {
  return withLock(async () => {
    const rows = await backend.loadCollection(name);
    const idx = rows.findIndex((r) => r.id === recordId);
    if (idx === -1) return false;
    rows.splice(idx, 1);
    await backend.saveCollection(name, rows);
    return true;
  });
}

async function findById(name, recordId) {
  const rows = await backend.loadCollection(name);
  return rows.find((r) => r.id === recordId) || null;
}

// ==================== חברי משפחה ====================

const store = {
  kind: backend.kind,

  async init() {
    await backend.init();
  },

  // ---- Members ----
  listMembers: () => all('members'),
  getMember: (mid) => findById('members', mid),
  async findMemberByName(name) {
    const rows = await all('members');
    const target = String(name || '').trim().toLowerCase();
    return rows.find((m) => m.name.trim().toLowerCase() === target) || null;
  },
  createMember: (fields) => insert('members', fields),
  updateMember: (mid, patch) => update('members', mid, patch),
  deleteMember: (mid) => remove('members', mid),

  // ---- Tasks (מטלות בית) ----
  async listTasks(filter = {}) {
    let rows = await all('tasks');
    if (filter.assignedTo) rows = rows.filter((t) => t.assignedTo === filter.assignedTo);
    if (filter.status) rows = rows.filter((t) => t.status === filter.status);
    return rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },
  getTask: (tid) => findById('tasks', tid),
  createTask: (fields) => insert('tasks', fields),
  updateTask: (tid, patch) => update('tasks', tid, patch),
  deleteTask: (tid) => remove('tasks', tid),

  // ---- Allowance (דמי כיס) ----
  async listAllowance(filter = {}) {
    let rows = await all('allowance');
    if (filter.memberId) rows = rows.filter((t) => t.memberId === filter.memberId);
    return rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },
  createAllowanceTxn: (fields) => insert('allowance', fields),
  deleteAllowanceTxn: (aid) => remove('allowance', aid),
  async getBalance(memberId) {
    const rows = await all('allowance');
    return rows
      .filter((t) => t.memberId === memberId)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  },

  // ---- Shopping (רשימת קניות) ----
  async listShopping(filter = {}) {
    let rows = await all('shopping');
    if (filter.status) rows = rows.filter((s) => s.status === filter.status);
    return rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },
  getShoppingItem: (sid) => findById('shopping', sid),
  createShoppingItem: (fields) => insert('shopping', fields),
  updateShoppingItem: (sid, patch) => update('shopping', sid, patch),
  deleteShoppingItem: (sid) => remove('shopping', sid),

  // ---- Surveys (סקרים והחלטות) ----
  async listSurveys() {
    const rows = await all('surveys');
    return rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },
  getSurvey: (sid) => findById('surveys', sid),
  createSurvey: (fields) => insert('surveys', fields),
  updateSurvey: (sid, patch) => update('surveys', sid, patch),
  deleteSurvey: (sid) => remove('surveys', sid),

  // הצבעה בסקר — נשמרת כמפה memberId → optionId (הצבעה יחידה לכל חבר).
  async voteSurvey(surveyId, memberId, optionId) {
    return withLock(async () => {
      const rows = await backend.loadCollection('surveys');
      const idx = rows.findIndex((s) => s.id === surveyId);
      if (idx === -1) return null;
      const survey = rows[idx];
      if (survey.status === 'closed') return survey;
      if (!survey.options.some((o) => o.id === optionId)) return null;
      survey.votes = survey.votes || {};
      survey.votes[memberId] = optionId;
      survey.updatedAt = nowIso();
      rows[idx] = survey;
      await backend.saveCollection('surveys', rows);
      return survey;
    });
  },

  _backend: backend,
};

module.exports = store;
