'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const store = require('./store');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TOKEN_TTL = '30d';

function hashPin(pin) {
  return bcrypt.hashSync(String(pin), 10);
}

function verifyPin(pin, pinHash) {
  return bcrypt.compareSync(String(pin), pinHash || '');
}

function signToken(member) {
  return jwt.sign({ sub: member.id, role: member.role, name: member.name }, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

// מוציא את החבר לתצוגה — בלי ה-hash של ה-PIN.
function publicMember(m) {
  if (!m) return null;
  const { pinHash, ...rest } = m;
  return rest;
}

// Middleware: מאמת טוקן ומצרף את req.member.
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'נדרשת התחברות' });

    const payload = jwt.verify(token, JWT_SECRET);
    const member = await store.getMember(payload.sub);
    if (!member) return res.status(401).json({ error: 'המשתמש לא נמצא' });

    req.member = member;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'טוקן לא תקין או שפג תוקפו' });
  }
}

// Middleware: מרשה רק להורים.
function requireParent(req, res, next) {
  if (!req.member || req.member.role !== 'parent') {
    return res.status(403).json({ error: 'פעולה זו מותרת להורים בלבד' });
  }
  next();
}

module.exports = {
  JWT_SECRET,
  hashPin,
  verifyPin,
  signToken,
  publicMember,
  authenticate,
  requireParent,
};
