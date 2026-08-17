'use strict';

const express = require('express');
const store = require('../store');
const notify = require('../notify');
const { authenticate, requireParent } = require('../auth');

const router = express.Router();
router.use(authenticate);

// רשימת קניות משותפת (אופציונלי לסנן לפי סטטוס).
router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const items = await store.listShopping(filter);
  res.json(items);
});

// הוספת פריט: ילד → בקשה הממתינה לאישור, הורה → מתווסף ישירות לרשימה.
router.post('/', async (req, res) => {
  const { name, qty, note } = req.body || {};
  if (!name || String(name).trim().length < 1) {
    return res.status(400).json({ error: 'שם מוצר נדרש' });
  }
  const isParent = req.member.role === 'parent';
  const item = await store.createShoppingItem({
    name: String(name).trim(),
    qty: qty ? String(qty).trim() : '',
    note: note ? String(note).trim() : '',
    status: isParent ? 'approved' : 'requested',
    requestedBy: req.member.id,
    approvedBy: isParent ? req.member.id : null,
  });
  if (!isParent) {
    const parents = (await store.listMembers()).filter((m) => m.role === 'parent');
    notify.toMembers(parents, `🛒 בית אחד: ${req.member.name} מבקש/ת להוסיף "${item.name}"${item.qty ? ` (${item.qty})` : ''} לרשימת הקניות — ממתין לאישור.`);
  }
  res.status(201).json(item);
});

// אישור בקשה (הורה) → הפריט מתווסף לרשימה.
router.post('/:id/approve', requireParent, async (req, res) => {
  const item = await store.getShoppingItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'הפריט לא נמצא' });
  const updated = await store.updateShoppingItem(item.id, {
    status: 'approved',
    approvedBy: req.member.id,
  });
  res.json(updated);
});

// דחיית בקשה (הורה).
router.post('/:id/reject', requireParent, async (req, res) => {
  const item = await store.getShoppingItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'הפריט לא נמצא' });
  const updated = await store.updateShoppingItem(item.id, {
    status: 'rejected',
    approvedBy: req.member.id,
    rejectNote: (req.body && req.body.note) ? String(req.body.note).trim() : '',
  });
  res.json(updated);
});

// סימון שנקנה (כל בן משפחה — רשימה משותפת).
router.post('/:id/purchased', async (req, res) => {
  const item = await store.getShoppingItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'הפריט לא נמצא' });
  if (item.status !== 'approved') {
    return res.status(409).json({ error: 'ניתן לסמן כנקנה רק פריט מאושר' });
  }
  const updated = await store.updateShoppingItem(item.id, {
    status: 'purchased',
    purchasedBy: req.member.id,
    purchasedAt: new Date().toISOString(),
  });
  res.json(updated);
});

// עריכת פריט (הורה).
router.patch('/:id', requireParent, async (req, res) => {
  const item = await store.getShoppingItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'הפריט לא נמצא' });
  const patch = {};
  const { name, qty, note, status } = req.body || {};
  if (name !== undefined) patch.name = String(name).trim();
  if (qty !== undefined) patch.qty = String(qty).trim();
  if (note !== undefined) patch.note = String(note).trim();
  if (status !== undefined) patch.status = status;
  const updated = await store.updateShoppingItem(req.params.id, patch);
  res.json(updated);
});

// מחיקה: הורה תמיד; ילד רק בקשה שלו שעדיין לא טופלה.
router.delete('/:id', async (req, res) => {
  const item = await store.getShoppingItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'הפריט לא נמצא' });
  const isOwnPending = item.requestedBy === req.member.id && item.status === 'requested';
  if (req.member.role !== 'parent' && !isOwnPending) {
    return res.status(403).json({ error: 'אין לך הרשאה למחוק פריט זה' });
  }
  await store.deleteShoppingItem(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
