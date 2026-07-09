'use strict';

/**
 * Backend מבוסס Postgres (ענן).
 * שומר כל "אוסף" (collection) כשורה אחת בטבלת collections עם עמודת jsonb.
 * מתאים לבית משפחתי (נפח נתונים קטן) ומאפשר גישה רב-מכשירית מהענן.
 */

const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool) {
    const useSsl = process.env.PGSSL !== 'false';
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

module.exports = {
  kind: 'postgres',

  async init() {
    const p = getPool();
    await p.query(`
      CREATE TABLE IF NOT EXISTS collections (
        name TEXT PRIMARY KEY,
        data JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  },

  async loadCollection(name) {
    const p = getPool();
    const res = await p.query('SELECT data FROM collections WHERE name = $1', [name]);
    if (res.rows.length === 0) return [];
    const data = res.rows[0].data;
    return Array.isArray(data) ? data : [];
  },

  async saveCollection(name, rows) {
    const p = getPool();
    await p.query(
      `INSERT INTO collections (name, data, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (name)
       DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [name, JSON.stringify(rows)]
    );
  },

  async close() {
    if (pool) {
      await pool.end();
      pool = null;
    }
  },
};
