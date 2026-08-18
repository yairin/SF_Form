'use strict';

/**
 * עזרי לוח עברי (ללא תלות חיצונית) — מבוססים על Intl עם לוח 'hebrew'.
 * משמשים לזיכוי דמי כיס חודשיים בכל ראש חודש עברי.
 */

function parts(date) {
  const f = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric' });
  const p = f.formatToParts(date || new Date());
  const get = (t) => (p.find((x) => x.type === t) || {}).value;
  return { year: get('year'), month: get('month'), day: Number(get('day')) };
}

// מפתח ייחודי לחודש העברי, לדוגמה "5786-Elul". משמש לסימון "כבר שולם החודש".
function monthKey(date) {
  const { year, month } = parts(date);
  return `${year}-${month}`;
}

// שם החודש העברי בעברית, לדוגמה "אלול".
function monthNameHe(date) {
  return new Intl.DateTimeFormat('he-u-ca-hebrew', { month: 'long' }).format(date || new Date());
}

// האם התאריך הוא ראש חודש (היום ה-1 בחודש העברי).
function isRoshChodesh(date) {
  return parts(date).day === 1;
}

module.exports = { parts, monthKey, monthNameHe, isRoshChodesh };
