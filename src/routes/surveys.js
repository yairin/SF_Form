'use strict';

const express = require('express');
const store = require('../store');
const { authenticate } = require('../auth');

const router = express.Router();
router.use(authenticate);

// מוסיף למבנה הסקר ספירת קולות ואת הבחירה של הצופה.
function decorate(survey, viewerId) {
  const votes = survey.votes || {};
  const counts = {};
  survey.options.forEach((o) => (counts[o.id] = 0));
  Object.values(votes).forEach((optId) => {
    if (counts[optId] !== undefined) counts[optId] += 1;
  });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    id: survey.id,
    question: survey.question,
    status: survey.status,
    createdBy: survey.createdBy,
    createdAt: survey.createdAt,
    closesAt: survey.closesAt || null,
    totalVotes: total,
    myVote: votes[viewerId] || null,
    options: survey.options.map((o) => ({
      id: o.id,
      text: o.text,
      votes: counts[o.id],
      percent: total ? Math.round((counts[o.id] / total) * 100) : 0,
    })),
  };
}

// רשימת הסקרים.
router.get('/', async (req, res) => {
  const surveys = await store.listSurveys();
  res.json(surveys.map((s) => decorate(s, req.member.id)));
});

// יצירת סקר — כל בן משפחה (כולל ילדים) יכול ליצור.
router.post('/', async (req, res) => {
  const { question, options, closesAt } = req.body || {};
  if (!question || String(question).trim().length < 3) {
    return res.status(400).json({ error: 'שאלה נדרשת (לפחות 3 תווים)' });
  }
  const cleaned = (Array.isArray(options) ? options : [])
    .map((o) => String(o).trim())
    .filter(Boolean);
  if (cleaned.length < 2) {
    return res.status(400).json({ error: 'נדרשות לפחות 2 אפשרויות' });
  }
  const crypto = require('crypto');
  const survey = await store.createSurvey({
    question: String(question).trim(),
    options: cleaned.map((text) => ({ id: crypto.randomUUID(), text })),
    votes: {},
    status: 'open',
    closesAt: closesAt || null,
    createdBy: req.member.id,
  });
  res.status(201).json(decorate(survey, req.member.id));
});

// הצבעה.
router.post('/:id/vote', async (req, res) => {
  const { optionId } = req.body || {};
  const survey = await store.voteSurvey(req.params.id, req.member.id, optionId);
  if (!survey) return res.status(400).json({ error: 'סקר או אפשרות לא תקינים' });
  res.json(decorate(survey, req.member.id));
});

// סגירת סקר — יוצר הסקר או הורה.
router.post('/:id/close', async (req, res) => {
  const survey = await store.getSurvey(req.params.id);
  if (!survey) return res.status(404).json({ error: 'הסקר לא נמצא' });
  if (survey.createdBy !== req.member.id && req.member.role !== 'parent') {
    return res.status(403).json({ error: 'רק יוצר הסקר או הורה יכולים לסגור אותו' });
  }
  const updated = await store.updateSurvey(survey.id, { status: 'closed' });
  res.json(decorate(updated, req.member.id));
});

// מחיקה — יוצר הסקר או הורה.
router.delete('/:id', async (req, res) => {
  const survey = await store.getSurvey(req.params.id);
  if (!survey) return res.status(404).json({ error: 'הסקר לא נמצא' });
  if (survey.createdBy !== req.member.id && req.member.role !== 'parent') {
    return res.status(403).json({ error: 'רק יוצר הסקר או הורה יכולים למחוק אותו' });
  }
  await store.deleteSurvey(survey.id);
  res.json({ ok: true });
});

module.exports = router;
