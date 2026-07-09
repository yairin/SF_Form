'use strict';

/**
 * Backend מבוסס קובץ JSON מקומי.
 * מתאים לפיתוח והרצה מהירה ללא מסד נתונים חיצוני.
 * חושף loadCollection / saveCollection — store.js בונה מעל זה את הלוגיקה.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let cache = null;

async function readAll() {
  if (cache) return cache;
  try {
    const raw = await fsp.readFile(DB_FILE, 'utf8');
    cache = JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      cache = {};
    } else {
      throw err;
    }
  }
  return cache;
}

async function persist() {
  if (!fs.existsSync(DATA_DIR)) {
    await fsp.mkdir(DATA_DIR, { recursive: true });
  }
  // כתיבה אטומית: כתיבה לקובץ זמני ואז rename.
  const tmp = `${DB_FILE}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(cache, null, 2), 'utf8');
  await fsp.rename(tmp, DB_FILE);
}

module.exports = {
  kind: 'json',

  async init() {
    await readAll();
  },

  async loadCollection(name) {
    const db = await readAll();
    return Array.isArray(db[name]) ? db[name] : [];
  },

  async saveCollection(name, rows) {
    const db = await readAll();
    db[name] = rows;
    await persist();
  },

  async close() {
    /* no-op */
  },
};
