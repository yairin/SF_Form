'use strict';

const store = require('./store');
const hebrew = require('./hebrew');

/**
 * זיכוי דמי כיס חודשיים קבועים — פעם אחת בכל חודש עברי.
 * לכל ילד עם monthlyAllowance > 0: אם עדיין לא זוכה בחודש העברי הנוכחי,
 * נזקף הסכום ומסומן החודש כמשולם (lastStipendMonth). רץ באתחול, מדי יום,
 * ובעצלתיים בעת התחברות — כך שאין צורך בשירות תזמון חיצוני.
 */
async function ensureMonthlyAllowances() {
  const key = hebrew.monthKey();
  const nameHe = hebrew.monthNameHe();
  const members = await store.listMembers();
  let granted = 0;
  for (const m of members) {
    const amount = Number(m.monthlyAllowance || 0);
    if (m.role !== 'child' || amount <= 0) continue;
    if (m.lastStipendMonth === key) continue;
    await store.createAllowanceTxn({
      memberId: m.id,
      amount,
      reason: `דמי כיס חודשיים (${nameHe})`,
      type: 'credit',
      source: 'stipend',
      month: key,
      createdBy: 'system',
    });
    await store.updateMember(m.id, { lastStipendMonth: key });
    granted += 1;
  }
  return granted;
}

module.exports = { ensureMonthlyAllowances };
