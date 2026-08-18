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

// מטלת "חובה" היא ללא תשלום תמיד; רק מטלת "בתשלום" נושאת סכום.
function normalizeType(type) {
  return type === 'paid' ? 'paid' : 'duty';
}
function normalizePoints(type, points) {
  return normalizeType(type) === 'paid' ? Math.max(0, Number(points) || 0) : 0;
}

// ===================== ספריית מטלות קבועה =====================

// רשימת התבניות הזמינות להקצאה מהירה.
router.get('/templates', async (req, res) => {
  const templates = await store.listTaskTemplates();
  res.json(templates);
});

// הוספת מטלה לספרייה (הורה) — ידנית, בנפרד מיצירת מטלה בפועל.
router.post('/templates', requireParent, async (req, res) => {
  const { title, notes, type, points } = req.body || {};
  if (!title || String(title).trim().length < 2) {
    return res.status(400).json({ error: 'כותרת נדרשת (לפחות 2 תווים)' });
  }
  const t = normalizeType(type);
  const template = await store.createTaskTemplate({
    title: String(title).trim(),
    notes: notes ? String(notes).trim() : '',
    type: t,
    points: normalizePoints(t, points),
    createdBy: req.member.id,
  });
  res.status(201).json(template);
});

// מחיקת תבנית מהספרייה (הורה).
router.delete('/templates/:id', requireParent, async (req, res) => {
  const ok = await store.deleteTaskTemplate(req.params.id);
  if (!ok) return res.status(404).json({ error: 'המטלה לא נמצאה בספרייה' });
  res.json({ ok: true });
});

// הקצאה מהירה: בחירת ילד + כמה תבניות מהספרייה בבת אחת → יוצר מטלה פתוחה לכל אחת.
router.post('/assign-from-templates', requireParent, async (req, res) => {
  const { assignedTo, templateIds, dueDate } = req.body || {};
  const assignee = await store.getMember(assignedTo);
  if (!assignee) return res.status(400).json({ error: 'יש לבחור בן משפחה' });
  const ids = Array.isArray(templateIds) ? templateIds : [];
  if (!ids.length) return res.status(400).json({ error: 'יש לבחור לפחות מטלה אחת מהרשימה' });

  const created = [];
  for (const tid of ids) {
    const tmpl = await store.getTaskTemplate(tid);
    if (!tmpl) continue;
    const task = await store.createTask({
      title: tmpl.title,
      notes: tmpl.notes || '',
      assignedTo: assignee.id,
      type: tmpl.type,
      points: tmpl.type === 'paid' ? Number(tmpl.points) || 0 : 0,
      dueDate: dueDate || null,
      status: 'open',
      createdBy: req.member.id,
      templateId: tmpl.id,
    });
    created.push(task);
  }
  if (created.length) {
    const names = created.map((t) => t.title).join(', ');
    notify.toMember(assignee, `🏠 בית אחד: הוקצו לך ${created.length} מטלות חדשות — ${names}`);
  }
  res.status(201).json(created);
});

// ===================== מטלות =====================

// רשימת מטלות — הורה רואה הכל, ילד רואה רק את שלו.
router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.member.role !== 'parent') filter.assignedTo = req.member.id;
  const tasks = await store.listTasks(filter);
  res.json(tasks);
});

// יצירת/הקצאת מטלה בודדת (הורה). type: 'duty' (חובה, ללא תשלום) או 'paid' (בתשלום).
// addToLibrary=true גם שומר את המטלה כתבנית קבועה לפעם הבאה.
router.post('/', requireParent, async (req, res) => {
  const { title, notes, assignedTo, type, points, dueDate, addToLibrary } = req.body || {};
  if (!title || String(title).trim().length < 2) {
    return res.status(400).json({ error: 'כותרת נדרשת (לפחות 2 תווים)' });
  }
  if (assignedTo) {
    const assignee = await store.getMember(assignedTo);
    if (!assignee) return res.status(400).json({ error: 'בן המשפחה שהוקצה לא נמצא' });
  }
  const t = normalizeType(type);
  const p = normalizePoints(t, points);
  const task = await store.createTask({
    title: String(title).trim(),
    notes: notes ? String(notes).trim() : '',
    assignedTo: assignedTo || null,
    type: t,
    points: p,
    dueDate: dueDate || null,
    status: 'open',
    createdBy: req.member.id,
  });
  if (addToLibrary) {
    await store.createTaskTemplate({
      title: task.title,
      notes: task.notes,
      type: t,
      points: p,
      createdBy: req.member.id,
    });
  }
  if (task.assignedTo) {
    const assignee = await store.getMember(task.assignedTo);
    notify.toMember(assignee, `🏠 בית אחד: הוקצתה לך מטלה חדשה — "${task.title}"${task.type === 'paid' && task.points > 0 ? ` (שווי ${task.points} ₪)` : ' (מטלת חובה)'}`);
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

// הורה מאשר מטלה — רק מטלה "בתשלום" עם סכום מזכה בדמי כיס.
router.post('/:id/approve', requireParent, async (req, res) => {
  const task = await store.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'המטלה לא נמצאה' });

  const updated = await store.updateTask(task.id, {
    status: 'approved',
    approvedAt: new Date().toISOString(),
    approvedBy: req.member.id,
  });

  // קישור מטלה ← דמי כיס: זיכוי אוטומטי רק למטלת "בתשלום".
  const isPaid = normalizeType(task.type) === 'paid';
  if (task.assignedTo && isPaid && Number(task.points) > 0) {
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
    notify.toMember(assignee, `🎉 בית אחד: המטלה "${task.title}" אושרה!${isPaid && Number(task.points) > 0 ? ` זוכית ב-${task.points} ₪ בדמי הכיס.` : ''}`);
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
  const { title, notes, assignedTo, type, points, dueDate, status } = req.body || {};
  if (title !== undefined) patch.title = String(title).trim();
  if (notes !== undefined) patch.notes = String(notes).trim();
  if (assignedTo !== undefined) patch.assignedTo = assignedTo || null;
  const effectiveType = normalizeType(type !== undefined ? type : task.type);
  if (type !== undefined) patch.type = effectiveType;
  if (points !== undefined || type !== undefined) {
    patch.points = normalizePoints(effectiveType, points !== undefined ? points : task.points);
  }
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
