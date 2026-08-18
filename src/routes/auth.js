'use strict';

const express = require('express');
const store = require('../store');
const { hashPin, verifyPin, signToken, publicMember, authenticate, requireParent } = require('../auth');

const router = express.Router();

const COLORS = ['#e74c3c', '#3498db', '#27ae60', '#f39c12', '#9b59b6', '#16a085', '#e67e22', '#2c3e50'];

function validPin(pin) {
  return /^\d{4,8}$/.test(String(pin || ''));
}

// מצב אתחול — האם כבר קיים בית (חבר ראשון).
router.get('/status', async (req, res) => {
  const members = await store.listMembers();
  res.json({ initialized: members.length > 0, requiresSetupCode: !!process.env.SETUP_CODE });
});

// רשימת פרופילים למסך ההתחברות (ללא מידע רגיש).
router.get('/profiles', async (req, res) => {
  const members = await store.listMembers();
  res.json(
    members.map((m) => ({ id: m.id, name: m.name, role: m.role, emoji: m.emoji, color: m.color }))
  );
});

// אתחול הבית — יצירת ההורה המנהל הראשון. מותר רק כשאין עדיין חברים.
router.post('/setup', async (req, res) => {
  const members = await store.listMembers();
  if (members.length > 0) {
    return res.status(409).json({ error: 'הבית כבר אותחל. התחבר עם פרופיל קיים.' });
  }
  const { name, pin, phone, setupCode } = req.body || {};
  if (process.env.SETUP_CODE && setupCode !== process.env.SETUP_CODE) {
    return res.status(403).json({ error: 'קוד הקמה שגוי' });
  }
  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ error: 'שם נדרש (לפחות 2 תווים)' });
  }
  if (!validPin(pin)) {
    return res.status(400).json({ error: 'קוד PIN חייב להיות 4-8 ספרות' });
  }
  const member = await store.createMember({
    name: String(name).trim(),
    role: 'parent',
    pinHash: hashPin(pin),
    emoji: '👑',
    color: COLORS[0],
    phone: phone ? String(phone).trim() : '',
    allowanceVisibleToSiblings: false,
  });
  const token = signToken(member);
  res.status(201).json({ token, member: publicMember(member) });
});

// התחברות עם שם + PIN.
router.post('/login', async (req, res) => {
  const { name, pin, memberId } = req.body || {};
  const member = memberId ? await store.getMember(memberId) : await store.findMemberByName(name);
  if (!member || !verifyPin(pin, member.pinHash)) {
    return res.status(401).json({ error: 'שם או קוד שגויים' });
  }
  const token = signToken(member);
  res.json({ token, member: publicMember(member) });
});

// פרטי המשתמש המחובר.
router.get('/me', authenticate, (req, res) => {
  res.json({ member: publicMember(req.member) });
});

// שינוי ה-PIN של המשתמש המחובר.
router.post('/change-pin', authenticate, async (req, res) => {
  const { currentPin, newPin } = req.body || {};
  if (!verifyPin(currentPin, req.member.pinHash)) {
    return res.status(403).json({ error: 'הקוד הנוכחי שגוי' });
  }
  if (!validPin(newPin)) {
    return res.status(400).json({ error: 'קוד PIN חדש חייב להיות 4-8 ספרות' });
  }
  await store.updateMember(req.member.id, { pinHash: hashPin(newPin) });
  res.json({ ok: true });
});

// ===== ניהול חברי משפחה (הורה בלבד) =====

// רשימה מלאה (מחובר).
router.get('/members', authenticate, async (req, res) => {
  const members = await store.listMembers();
  res.json(members.map(publicMember));
});

// הוספת בן משפחה.
router.post('/members', authenticate, requireParent, async (req, res) => {
  const { name, pin, role, emoji, color, phone, monthlyAllowance, allowanceVisibleToSiblings } = req.body || {};
  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ error: 'שם נדרש (לפחות 2 תווים)' });
  }
  if (!validPin(pin)) {
    return res.status(400).json({ error: 'קוד PIN חייב להיות 4-8 ספרות' });
  }
  if (!['parent', 'child'].includes(role)) {
    return res.status(400).json({ error: 'תפקיד חייב להיות parent או child' });
  }
  if (await store.findMemberByName(name)) {
    return res.status(409).json({ error: 'כבר קיים בן משפחה בשם הזה' });
  }
  const count = (await store.listMembers()).length;
  const member = await store.createMember({
    name: String(name).trim(),
    role,
    pinHash: hashPin(pin),
    emoji: emoji || (role === 'parent' ? '🧑' : '🧒'),
    color: color || COLORS[count % COLORS.length],
    phone: phone ? String(phone).trim() : '',
    monthlyAllowance: Math.max(0, Number(monthlyAllowance) || 0),
    lastStipendMonth: null,
    allowanceVisibleToSiblings: !!allowanceVisibleToSiblings,
  });
  res.status(201).json(publicMember(member));
});

// עדכון בן משפחה (כולל איפוס PIN, שינוי הרשאת צפייה בדמי כיס).
router.patch('/members/:id', authenticate, requireParent, async (req, res) => {
  const target = await store.getMember(req.params.id);
  if (!target) return res.status(404).json({ error: 'בן המשפחה לא נמצא' });

  const patch = {};
  const { name, emoji, color, role, pin, phone, monthlyAllowance, allowanceVisibleToSiblings } = req.body || {};
  if (name !== undefined) {
    if (String(name).trim().length < 2) return res.status(400).json({ error: 'שם קצר מדי' });
    patch.name = String(name).trim();
  }
  if (emoji !== undefined) patch.emoji = emoji;
  if (color !== undefined) patch.color = color;
  if (phone !== undefined) patch.phone = String(phone).trim();
  if (monthlyAllowance !== undefined) patch.monthlyAllowance = Math.max(0, Number(monthlyAllowance) || 0);
  if (role !== undefined) {
    if (!['parent', 'child'].includes(role)) return res.status(400).json({ error: 'תפקיד לא תקין' });
    patch.role = role;
  }
  if (allowanceVisibleToSiblings !== undefined) {
    patch.allowanceVisibleToSiblings = !!allowanceVisibleToSiblings;
  }
  if (pin !== undefined) {
    if (!validPin(pin)) return res.status(400).json({ error: 'קוד PIN חייב להיות 4-8 ספרות' });
    patch.pinHash = hashPin(pin);
  }
  const updated = await store.updateMember(req.params.id, patch);
  res.json(publicMember(updated));
});

// מחיקת בן משפחה — לא ניתן למחוק את ההורה האחרון.
router.delete('/members/:id', authenticate, requireParent, async (req, res) => {
  const target = await store.getMember(req.params.id);
  if (!target) return res.status(404).json({ error: 'בן המשפחה לא נמצא' });
  const members = await store.listMembers();
  const parents = members.filter((m) => m.role === 'parent');
  if (target.role === 'parent' && parents.length <= 1) {
    return res.status(400).json({ error: 'לא ניתן למחוק את ההורה האחרון' });
  }
  await store.deleteMember(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
