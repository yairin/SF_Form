'use strict';

const express = require('express');
const store = require('../store');
const { authenticate } = require('../auth');

const router = express.Router();
router.use(authenticate);

// סיכום שבועי: מטלות שאושרו, נקודות שנצברו, ומיהו "אלוף הבית" השבוע.
router.get('/weekly', async (req, res) => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [members, tasks] = await Promise.all([store.listMembers(), store.listTasks()]);

  const perMember = {};
  members.forEach((m) => {
    perMember[m.id] = {
      memberId: m.id,
      name: m.name,
      emoji: m.emoji,
      color: m.color,
      role: m.role,
      approved: 0,
      points: 0,
    };
  });

  let pending = 0;
  let open = 0;
  for (const t of tasks) {
    if (t.status === 'submitted') pending += 1;
    if (t.status === 'open' || t.status === 'rejected') open += 1;
    if (t.status === 'approved' && (t.approvedAt || '') >= since && t.assignedTo && perMember[t.assignedTo]) {
      perMember[t.assignedTo].approved += 1;
      perMember[t.assignedTo].points += Number(t.points) || 0;
    }
  }

  const children = Object.values(perMember).filter((m) => m.role === 'child');
  const ranking = children.sort((a, b) => b.points - a.points || b.approved - a.approved);
  const champion = ranking.length && (ranking[0].points > 0 || ranking[0].approved > 0)
    ? ranking[0]
    : null;

  res.json({
    weekStart: since,
    champion,
    ranking,
    counts: { pendingApproval: pending, openTasks: open },
  });
});

module.exports = router;
