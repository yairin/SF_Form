'use strict';

const express = require('express');
const store = require('../store');
const notify = require('../notify');
const { authenticate, requireParent } = require('../auth');

const router = express.Router();
router.use(authenticate);

async function parents() {
  return (await store.listMembers()).filter((m) => m.role === 'parent');
}

// רשימת מטלות — הורה רואה הכל, ילד רואה רק את שלו.
router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.member.role !== 'parent') filter.assignedTo = req.member.id;
  const tasks = await store.listTasks(filter);
  res.json(tasks);
});

// יצירת/הקצאת מטלה (הורה).
router.post('/', requireParent, async (req, res) => {
  const { title, notes, assignedTo, points, dueDate } = req.body || {};
  if (!title || String(title).trim().length < 2) {
    return res.status(400).json({ error: 'כותרת נדרשת (לפחות 2 תווים)' });
  }
  if (assignedTo) {
    const assignee = await store.getMember(assignedTo);
    if (!assignee) return res.status(400).json({ error: 'בן המשפחה שהוקצה לא נמצא' });
  }
  const task = await store.createTask({
    title: String(title).trim(),
    notes: notes ? String(notes).trim() : '',
    assignedTo: assignedTo || null,
    points: Number(points) || 0,
    dueDate: dueDate || null,
    status: 'open',
    createdBy: req.member.id,
  });
  if (task.assignedTo) {
    const assignee = await store.getMember(task.assignedTo);
    notify.toMember(assignee, `🏠 בית אחד: הוקצתה לך מטלה חדשה — "${task.title}"${task.points > 0 ? ` (שווי ${task.points} ₪)` : ''}`);
  }
  res.status(201).json(task);
});

// ילד (או הורה) מסמן שהמטלה בוצעה → ממתין לאישור.
router.post('/:id/submit', async (req, res) => {
  const task = await store.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'המטלה לא נמצאה' });
  if (req.member.role !== 'parent' && task.assignedTo !== req.member.id) {
    return res.status(403).json({ error: 'ניתן לסמן רק מטלה שהוקצתה לך' });
  }
  if (!['open', 'rejected'].includes(task.status)) {
    return res.status(409).json({ error: 'לא ניתן לסמן מטלה במצב הנוכחי' });
  }
  const updated = await store.updateTask(task.id, {
    status: 'submitted',
    submittedAt: new Date().toISOString(),
    submittedBy: req.member.id,
  });
  notify.toMembers(await parents(), `🏠 בית אחד: ${req.member.name} סימן/ה שסיים/ה את המטלה "${task.title}" — ממתין לאישורך.`);
  res.json(updated);
});

// הורה מאשר מטלה — אם יש נקודות/סכום, נזקף זיכוי דמי כיס לילד שביצע.
router.post('/:id/approve', requireParent, async (req, res) => {
  const task = await store.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'המטלה לא נמצאה' });

  const updated = await store.updateTask(task.id, {
    status: 'approved',
    approvedAt: new Date().toISOString(),
    approvedBy: req.member.id,
  });

  // קישור מטלה ← דמי כיס: זיכוי אוטומטי לילד שביצע.
  if (task.assignedTo && Number(task.points) > 0) {
    await store.createAllowanceTxn({
      memberId: task.assignedTo,
      amount: Number(task.points),
      reason: `מטלה: ${task.title}`,
      type: 'credit',
      source: 'task',
      taskId: task.id,
      createdBy: req.member.id,
    });
  }
  if (task.assignedTo) {
    const assignee = await store.getMember(task.assignedTo);
    notify.toMember(assignee, `🎉 בית אחד: המטלה "${task.title}" אושרה!${Number(task.points) > 0 ? ` זוכית ב-${task.points} ₪ בדמי הכיס.` : ''}`);
  }
  res.json(updated);
});

// הורה מחזיר מטלה לביצוע (דחייה) עם הערה.
router.post('/:id/reject', requireParent, async (req, res) => {
  const task = await store.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'המטלה לא נמצאה' });
  const updated = await store.updateTask(task.id, {
    status: 'rejected',
    rejectNote: (req.body && req.body.note) ? String(req.body.note).trim() : '',
    approvedBy: null,
    approvedAt: null,
  });
  res.json(updated);
});

// עריכת מטלה (הורה).
router.patch('/:id', requireParent, async (req, res) => {
  const task = await store.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'המטלה לא נמצאה' });
  const patch = {};
  const { title, notes, assignedTo, points, dueDate, status } = req.body || {};
  if (title !== undefined) patch.title = String(title).trim();
  if (notes !== undefined) patch.notes = String(notes).trim();
  if (assignedTo !== undefined) patch.assignedTo = assignedTo || null;
  if (points !== undefined) patch.points = Number(points) || 0;
  if (dueDate !== undefined) patch.dueDate = dueDate || null;
  if (status !== undefined) patch.status = status;
  const updated = await store.updateTask(req.params.id, patch);
  res.json(updated);
});

// מחיקת מטלה (הורה).
router.delete('/:id', requireParent, async (req, res) => {
  const ok = await store.deleteTask(req.params.id);
  if (!ok) return res.status(404).json({ error: 'המטלה לא נמצאה' });
  res.json({ ok: true });
});

module.exports = router;
