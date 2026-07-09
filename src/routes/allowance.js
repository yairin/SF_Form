'use strict';

const express = require('express');
const store = require('../store');
const { authenticate, requireParent } = require('../auth');

const router = express.Router();
router.use(authenticate);

// האם הצופה רשאי לראות את דמי הכיס של memberId.
async function canView(viewer, targetId) {
  if (viewer.role === 'parent') return true;
  if (viewer.id === targetId) return true;
  const target = await store.getMember(targetId);
  return !!(target && target.allowanceVisibleToSiblings);
}

// סיכום יתרות לכל בני המשפחה שהצופה רשאי לראות.
router.get('/balances', async (req, res) => {
  const members = await store.listMembers();
  const result = [];
  for (const m of members) {
    if (await canView(req.member, m.id)) {
      result.push({
        memberId: m.id,
        name: m.name,
        emoji: m.emoji,
        color: m.color,
        role: m.role,
        balance: await store.getBalance(m.id),
      });
    }
  }
  res.json(result);
});

// תנועות דמי כיס של בן משפחה מסוים (בכפוף להרשאה).
router.get('/:memberId', async (req, res) => {
  const target = await store.getMember(req.params.memberId);
  if (!target) return res.status(404).json({ error: 'בן המשפחה לא נמצא' });
  if (!(await canView(req.member, target.id))) {
    return res.status(403).json({ error: 'אין לך הרשאה לצפות בדמי הכיס האלה' });
  }
  const transactions = await store.listAllowance({ memberId: target.id });
  const balance = await store.getBalance(target.id);
  res.json({ memberId: target.id, name: target.name, balance, transactions });
});

// הוספת תנועה ידנית (הורה): זיכוי או חיוב.
router.post('/', requireParent, async (req, res) => {
  const { memberId, amount, reason, type } = req.body || {};
  const target = await store.getMember(memberId);
  if (!target) return res.status(400).json({ error: 'בן המשפחה לא נמצא' });
  const raw = Number(amount);
  if (!Number.isFinite(raw) || raw === 0) {
    return res.status(400).json({ error: 'סכום לא תקין' });
  }
  // חיוב = שלילי, זיכוי = חיובי. אם צוין type הוא קובע את הסימן.
  let signed = raw;
  if (type === 'debit') signed = -Math.abs(raw);
  if (type === 'credit') signed = Math.abs(raw);
  const txn = await store.createAllowanceTxn({
    memberId: target.id,
    amount: signed,
    reason: reason ? String(reason).trim() : (signed >= 0 ? 'זיכוי' : 'חיוב'),
    type: signed >= 0 ? 'credit' : 'debit',
    source: 'manual',
    createdBy: req.member.id,
  });
  const balance = await store.getBalance(target.id);
  res.status(201).json({ transaction: txn, balance });
});

// מחיקת תנועה (הורה).
router.delete('/txn/:id', requireParent, async (req, res) => {
  const ok = await store.deleteAllowanceTxn(req.params.id);
  if (!ok) return res.status(404).json({ error: 'התנועה לא נמצאה' });
  res.json({ ok: true });
});

module.exports = router;
