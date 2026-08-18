'use strict';

/* ============================================================
   בית אחד — לוגיקת צד־לקוח (Vanilla JS, RTL)
   ============================================================ */

const EMOJIS = ['🧒','👦','👧','🧑','👩','👨','👵','👴','🐱','🐶','🦊','🐼','🚀','⭐','🌟','🦄'];
const COLORS = ['#e74c3c','#3498db','#27ae60','#f39c12','#9b59b6','#16a085','#e67e22','#2c3e50'];

const state = {
  token: localStorage.getItem('token') || null,
  me: JSON.parse(localStorage.getItem('me') || 'null'),
  view: 'dashboard',
  members: [],
};

let authPin = '';
let authProfile = null; // {id,name,...} being logged into

/* ---------- utilities ---------- */
function $(sel, root) { return (root || document).querySelector(sel); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function money(n) { return `${Number(n || 0).toLocaleString('he-IL')} ₪`; }
function isParent() { return state.me && state.me.role === 'parent'; }

function toast(msg, type) {
  const t = document.getElementById('toast');
  t.className = 'toast show ' + (type || '');
  t.textContent = msg;
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.className = 'toast'; }, 2800);
}

async function api(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) {
    const msg = (data && (data.error || (data.errors && data.errors.join(', ')))) || 'אירעה שגיאה';
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

function saveSession(token, member) {
  state.token = token;
  state.me = member;
  localStorage.setItem('token', token);
  localStorage.setItem('me', JSON.stringify(member));
}
function logout() {
  state.token = null; state.me = null;
  localStorage.removeItem('token'); localStorage.removeItem('me');
  authPin = ''; authProfile = null;
  boot();
}

function avatar(m, cls) {
  const bg = (m && m.color) || '#888';
  const emoji = (m && m.emoji) || '🙂';
  return `<div class="${cls || 'avatar-sm'}" style="background:${esc(bg)}">${esc(emoji)}</div>`;
}
function memberById(id) { return state.members.find((m) => m.id === id); }
function memberName(id) { const m = memberById(id); return m ? m.name : '—'; }

/* ---------- modal ---------- */
function openModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-backdrop" id="mbd"><div class="modal" onclick="event.stopPropagation()">${html}</div></div>`;
  $('#mbd').addEventListener('click', closeModal);
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

/* ============================================================
   Boot
   ============================================================ */
async function boot() {
  const app = document.getElementById('app');
  try {
    const status = await api('GET', '/auth/status');
    if (!status.initialized) return renderSetup(status.requiresSetupCode);
    if (state.token) {
      try {
        const me = await api('GET', '/auth/me');
        state.me = me.member;
        localStorage.setItem('me', JSON.stringify(me.member));
        return renderApp();
      } catch (_) { /* token invalid → login */ }
    }
    return renderLogin();
  } catch (err) {
    app.innerHTML = `<div class="auth-wrap"><div class="auth-card center"><div class="auth-logo">🏠</div><p>לא ניתן להתחבר לשרת.<br>${esc(err.message)}</p><button class="btn primary block" onclick="boot()">נסה שוב</button></div></div>`;
  }
}

/* ============================================================
   Setup (יצירת ההורה הראשון)
   ============================================================ */
function renderSetup(requiresCode) {
  authPin = '';
  document.getElementById('app').innerHTML = `
    <div class="auth-wrap"><div class="auth-card">
      <div class="auth-logo">🏠</div>
      <div class="auth-title">ברוכים הבאים לבית אחד</div>
      <div class="auth-sub">בואו נקים את הבית — צרו את פרופיל ההורה המנהל</div>
      <div class="field"><label>השם שלך</label><input id="su-name" placeholder="לדוגמה: אמא" /></div>
      ${requiresCode ? '<div class="field"><label>קוד הקמה</label><input id="su-code" placeholder="קוד שניתן לך" /></div>' : ''}
      <div class="field"><label>קוד PIN (4-8 ספרות)</label><input id="su-pin" type="password" inputmode="numeric" placeholder="••••" /></div>
      <button class="btn primary block" id="su-go">הקמת הבית</button>
    </div></div>`;
  $('#su-go').addEventListener('click', async () => {
    const name = $('#su-name').value.trim();
    const pin = $('#su-pin').value.trim();
    const setupCode = requiresCode ? $('#su-code').value.trim() : undefined;
    if (name.length < 2) return toast('נא להזין שם', 'err');
    if (!/^\d{4,8}$/.test(pin)) return toast('קוד PIN חייב 4-8 ספרות', 'err');
    try {
      const r = await api('POST', '/auth/setup', { name, pin, setupCode });
      saveSession(r.token, r.member);
      toast('הבית הוקם! 🎉', 'ok');
      renderApp();
    } catch (err) { toast(err.message, 'err'); }
  });
}

/* ============================================================
   Login (בחירת פרופיל + PIN)
   ============================================================ */
async function renderLogin() {
  authPin = ''; authProfile = null;
  const profiles = await api('GET', '/auth/profiles');
  const grid = profiles.map((p) => `
    <div class="profile-btn" data-id="${p.id}" onclick="selectProfile('${p.id}')">
      ${avatar(p, 'profile-avatar')}
      <div class="profile-name">${esc(p.name)}</div>
      <div class="profile-role">${p.role === 'parent' ? 'הורה' : 'ילד/ה'}</div>
    </div>`).join('');
  state._profiles = profiles;
  document.getElementById('app').innerHTML = `
    <div class="auth-wrap"><div class="auth-card">
      <div class="auth-logo">🏠</div>
      <div class="auth-title">בית אחד</div>
      <div class="auth-sub">מי מתחבר?</div>
      <div class="profile-grid">${grid}</div>
      <div id="pin-area"></div>
    </div></div>`;
}

function selectProfile(id) {
  authProfile = state._profiles.find((p) => p.id === id);
  authPin = '';
  document.querySelectorAll('.profile-btn').forEach((b) =>
    b.classList.toggle('selected', b.dataset.id === id));
  renderPinArea();
}

function renderPinArea() {
  const dots = Array.from({ length: Math.max(4, authPin.length) })
    .map((_, i) => `<div class="pin-dot ${i < authPin.length ? 'filled' : ''}"></div>`).join('');
  const keys = ['1','2','3','4','5','6','7','8','9','⌫','0','✓']
    .map((k) => `<button class="pin-key" onclick="pinKey('${k}')">${k}</button>`).join('');
  $('#pin-area').innerHTML = `
    <div class="auth-sub" style="margin:6px 0">הזן/י קוד PIN של ${esc(authProfile.name)}</div>
    <div class="pin-display">${dots}</div>
    <div class="pin-pad">${keys}</div>`;
}

async function pinKey(k) {
  if (k === '⌫') { authPin = authPin.slice(0, -1); return renderPinArea(); }
  if (k === '✓') {
    if (authPin.length < 4) return toast('קוד קצר מדי', 'err');
    try {
      const r = await api('POST', '/auth/login', { memberId: authProfile.id, pin: authPin });
      saveSession(r.token, r.member);
      toast('שלום ' + r.member.name + '! 👋', 'ok');
      state.view = 'dashboard';
      renderApp();
    } catch (err) { authPin = ''; renderPinArea(); toast(err.message, 'err'); }
    return;
  }
  if (authPin.length >= 8) return;
  authPin += k;
  renderPinArea();
}

/* ============================================================
   App shell
   ============================================================ */
const NAV = [
  { key: 'dashboard', ico: '🏠', label: 'בית' },
  { key: 'tasks', ico: '✅', label: 'מטלות' },
  { key: 'allowance', ico: '💰', label: 'דמי כיס' },
  { key: 'shopping', ico: '🛒', label: 'קניות' },
  { key: 'surveys', ico: '📊', label: 'סקרים' },
];

async function renderApp() {
  try { state.members = await api('GET', '/auth/members'); } catch (_) { state.members = []; }
  const nav = NAV.map((n) => `
    <button class="nav-item ${state.view === n.key ? 'active' : ''}" onclick="go('${n.key}')">
      <span class="nav-ico">${n.ico}</span><span>${n.label}</span>
    </button>`).join('');
  document.getElementById('app').innerHTML = `
    <div class="topbar">
      <div class="topbar-row">
        <h1>🏠 בית אחד</h1>
        <div class="who">
          ${avatar(state.me, 'who-avatar')}
          <span>${esc(state.me.name)}</span>
          <button class="icon-btn" onclick="go('family')">⚙️</button>
        </div>
      </div>
      <div id="champion"></div>
    </div>
    <main id="view"></main>
    <div id="fab"></div>
    <nav class="bottomnav">${nav}</nav>`;
  loadChampion();
  renderView();
}

function go(view) {
  state.view = view;
  document.querySelectorAll('.nav-item').forEach((b, i) =>
    b.classList.toggle('active', NAV[i] && NAV[i].key === view));
  renderView();
}

async function loadChampion() {
  try {
    const s = await api('GET', '/summary/weekly');
    const el = $('#champion');
    if (!el) return;
    if (s.champion) {
      el.innerHTML = `<div class="champion-banner"><span class="medal">🏆</span>
        <div>אלוף/ת הבית השבוע: <b>${esc(s.champion.name)}</b> · ${s.champion.approved} מטלות · ${money(s.champion.points)}</div></div>`;
    } else if (s.counts.pendingApproval > 0 && isParent()) {
      el.innerHTML = `<div class="champion-banner"><span class="medal">⏳</span><div>${s.counts.pendingApproval} מטלות ממתינות לאישורך</div></div>`;
    } else {
      el.innerHTML = '';
    }
  } catch (_) {}
}

function renderView() {
  $('#fab').innerHTML = '';
  const v = state.view;
  if (v === 'dashboard') return viewDashboard();
  if (v === 'tasks') return viewTasks();
  if (v === 'allowance') return viewAllowance();
  if (v === 'shopping') return viewShopping();
  if (v === 'surveys') return viewSurveys();
  if (v === 'family') return viewFamily();
}

/* ============================================================
   Dashboard
   ============================================================ */
async function viewDashboard() {
  const view = $('#view');
  view.innerHTML = '<div class="empty">טוען…</div>';
  const [summary, tasks] = await Promise.all([
    api('GET', '/summary/weekly'),
    api('GET', '/tasks'),
  ]);
  const myOpen = tasks.filter((t) => ['open', 'rejected'].includes(t.status)).length;
  const pending = tasks.filter((t) => t.status === 'submitted').length;

  let cards = '';
  if (isParent()) {
    cards += statCard('⏳', 'ממתין לאישור', pending, 'tasks');
    cards += statCard('📝', 'מטלות פתוחות', myOpen, 'tasks');
  } else {
    cards += statCard('📝', 'המטלות שלי', myOpen, 'tasks');
  }

  const rank = (summary.ranking || []).filter((r) => r.approved > 0 || r.points > 0);
  let rankHtml = '';
  if (rank.length) {
    rankHtml = `<div class="section-title">🏆 טבלת השבוע</div><div class="card">` +
      rank.map((r, i) => `<div class="item">
        <div style="font-size:20px;width:26px;text-align:center">${['🥇','🥈','🥉'][i] || (i + 1)}</div>
        ${avatar(r)}
        <div class="item-main"><div class="item-title">${esc(r.name)}</div>
        <div class="item-sub">${r.approved} מטלות שאושרו</div></div>
        <div class="badge points">${money(r.points)}</div></div>`).join('') + `</div>`;
  }

  view.innerHTML = `
    <div class="section-title">שלום ${esc(state.me.name)} 👋</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">${cards}</div>
    ${rankHtml}
    <div class="section-title">קיצורי דרך</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
      ${shortcut('✅','מטלות','tasks')}
      ${shortcut('💰','דמי כיס','allowance')}
      ${shortcut('🛒','קניות','shopping')}
      ${shortcut('📊','סקרים','surveys')}
    </div>`;
}
function statCard(ico, label, num, target) {
  return `<div class="card" style="cursor:pointer" onclick="go('${target}')">
    <div style="font-size:26px">${ico}</div>
    <div style="font-size:30px;font-weight:800">${num}</div>
    <div class="item-sub">${label}</div></div>`;
}
function shortcut(ico, label, target) {
  return `<div class="card center" style="cursor:pointer" onclick="go('${target}')">
    <div style="font-size:34px">${ico}</div><div style="font-weight:700;margin-top:4px">${label}</div></div>`;
}

/* ============================================================
   Tasks (מטלות)
   ============================================================ */
async function viewTasks() {
  const view = $('#view');
  view.innerHTML = '<div class="empty">טוען…</div>';
  const tasks = await api('GET', '/tasks');
  if (isParent()) {
    $('#fab').innerHTML = `<div class="fab"><button class="btn primary" onclick="taskForm()">➕ מטלה</button></div>`;
  }
  const quickBtn = isParent() ? `<button class="btn outline block" onclick="quickAssignForm()" style="margin-bottom:12px">📋 הקצאה מהירה מרשימת מטלות</button>` : '';
  if (!tasks.length) {
    view.innerHTML = quickBtn + emptyState('✅', 'אין מטלות עדיין', isParent() ? 'הוסף מטלה ראשונה עם הכפתור למטה' : 'כל הכבוד, אין מה לעשות כרגע!');
    return;
  }
  const groups = {
    submitted: tasks.filter((t) => t.status === 'submitted'),
    open: tasks.filter((t) => ['open', 'rejected'].includes(t.status)),
    approved: tasks.filter((t) => t.status === 'approved'),
  };
  let html = '';
  if (groups.submitted.length) html += taskGroup('⏳ ממתין לאישור', groups.submitted);
  if (groups.open.length) html += taskGroup('📝 לביצוע', groups.open);
  if (groups.approved.length) html += taskGroup('✅ הושלמו', groups.approved.slice(0, 12));
  view.innerHTML = quickBtn + html;
}
function taskGroup(title, list) {
  return `<div class="section-title">${title}</div><div class="card">${list.map(taskRow).join('')}</div>`;
}
function taskRow(t) {
  const assignee = memberById(t.assignedTo);
  const statusLabel = { open: 'פתוח', submitted: 'ממתין', approved: 'אושר', rejected: 'הוחזר' }[t.status];
  let actions = '';
  const mine = state.me.id === t.assignedTo;
  if ((mine || isParent()) && ['open', 'rejected'].includes(t.status)) {
    actions += `<button class="btn green sm" onclick="taskSubmit('${t.id}')">סיימתי ✓</button>`;
  }
  if (isParent() && t.status === 'submitted') {
    actions += `<button class="btn green sm" onclick="taskApprove('${t.id}')">אישור</button>`;
    actions += `<button class="btn outline sm" onclick="taskReject('${t.id}')">החזר</button>`;
  }
  if (isParent()) {
    actions += `<button class="btn ghost sm" onclick="taskDelete('${t.id}')">🗑️</button>`;
  }
  const sub = [
    assignee ? `${assignee.emoji} ${esc(assignee.name)}` : 'לא הוקצה',
    t.dueDate ? '📅 ' + esc(t.dueDate) : null,
    t.rejectNote ? '↩︎ ' + esc(t.rejectNote) : null,
  ].filter(Boolean).join(' · ');
  const isPaid = t.type === 'paid';
  const typeBadge = `<span class="badge ${isPaid ? 'points' : 'duty'}">${isPaid ? money(t.points) : 'ללא תשלום'}</span>`;
  return `<div class="item">
    ${assignee ? avatar(assignee) : '<div class="avatar-sm" style="background:#ccc">?</div>'}
    <div class="item-main">
      <div class="item-title">${esc(t.title)}</div>
      <div class="item-sub">${sub}</div>
      ${t.notes ? `<div class="item-sub">${esc(t.notes)}</div>` : ''}
    </div>
    <div class="item-actions">${typeBadge}<span class="badge ${t.status}">${statusLabel}</span>${actions}</div>
  </div>`;
}
let taskFormState = null;
function taskForm(t) {
  taskFormState = {
    editId: t ? t.id : '',
    title: t ? t.title : '',
    assignedTo: t ? (t.assignedTo || '') : '',
    type: t ? (t.type || 'duty') : 'duty',
    points: t ? (t.points || 0) : 0,
    dueDate: t && t.dueDate ? t.dueDate : '',
    notes: t ? (t.notes || '') : '',
    addToLibrary: false,
  };
  openModal(renderTaskForm());
}
function renderTaskForm() {
  const s = taskFormState;
  const opts = state.members.map((m) => `<option value="${m.id}" ${s.assignedTo === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
  return `
    <h3>${s.editId ? 'עריכת מטלה' : 'מטלה חדשה'}</h3>
    <div class="field"><label>כותרת</label><input id="t-title" value="${esc(s.title)}" oninput="taskFormState.title=this.value" placeholder="לדוגמה: לסדר את החדר" /></div>
    <div class="field"><label>למי מוקצה</label><select id="t-assignee" onchange="taskFormState.assignedTo=this.value"><option value="">— ללא —</option>${opts}</select></div>
    <div class="field-row">
      <div class="field"><label>סוג מטלה</label>
        <select id="t-type" onchange="taskFormTypeChange(this.value)">
          <option value="duty" ${s.type === 'duty' ? 'selected' : ''}>חובה (ללא תשלום)</option>
          <option value="paid" ${s.type === 'paid' ? 'selected' : ''}>בתשלום</option>
        </select>
      </div>
      ${s.type === 'paid' ? `<div class="field"><label>סכום (₪)</label><input id="t-points" type="number" min="0" value="${s.points}" oninput="taskFormState.points=Number(this.value)||0" /></div>` : ''}
    </div>
    <div class="field"><label>תאריך יעד <span class="optional">(אופציונלי)</span></label><input id="t-due" type="date" value="${esc(s.dueDate)}" oninput="taskFormState.dueDate=this.value" /></div>
    <div class="field"><label>הערות</label><textarea id="t-notes" rows="2" oninput="taskFormState.notes=this.value">${esc(s.notes)}</textarea></div>
    ${!s.editId ? `<div class="checkbox-row"><input type="checkbox" id="t-addlib" onchange="taskFormState.addToLibrary=this.checked" /><label for="t-addlib">הוסף לרשימת המטלות הקבועה</label></div>` : ''}
    <div class="modal-actions">
      <button class="btn ghost" onclick="closeModal()">ביטול</button>
      <button class="btn primary" onclick="taskSave()">שמירה</button>
    </div>`;
}
function taskFormTypeChange(v) {
  taskFormState.type = v;
  if (v === 'duty') taskFormState.points = 0;
  $('.modal').innerHTML = renderTaskForm();
}
async function taskSave() {
  const s = taskFormState;
  const body = {
    title: s.title.trim(),
    assignedTo: s.assignedTo || null,
    type: s.type,
    points: s.type === 'paid' ? Number(s.points) || 0 : 0,
    dueDate: s.dueDate || null,
    notes: s.notes.trim(),
  };
  if (body.title.length < 2) return toast('נא להזין כותרת', 'err');
  if (!s.editId) body.addToLibrary = !!s.addToLibrary;
  try {
    if (s.editId) await api('PATCH', '/tasks/' + s.editId, body);
    else await api('POST', '/tasks', body);
    closeModal(); toast('נשמר', 'ok'); viewTasks(); loadChampion();
  } catch (err) { toast(err.message, 'err'); }
}

/* ---------- הקצאה מהירה מרשימת מטלות קבועה ---------- */
let quickAssignState = null;
async function quickAssignForm() {
  const templates = await api('GET', '/tasks/templates');
  const firstChild = state.members.find((m) => m.role === 'child');
  quickAssignState = {
    assignedTo: firstChild ? firstChild.id : '',
    selected: new Set(),
    templates,
    newTitle: '',
    newType: 'duty',
    newPoints: 0,
  };
  openModal(renderQuickAssign());
}
function renderQuickAssign() {
  const s = quickAssignState;
  const kids = state.members.filter((m) => m.role === 'child');
  const kidOpts = kids.length
    ? kids.map((m) => `<option value="${m.id}" ${s.assignedTo === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')
    : '<option value="">אין ילדים במשפחה</option>';
  const rows = s.templates.length
    ? s.templates.map((t) => `
      <div class="item" style="padding:8px 2px">
        <input type="checkbox" style="width:18px;height:18px;margin-top:3px" ${s.selected.has(t.id) ? 'checked' : ''} onchange="quickAssignToggle('${t.id}', this.checked)" />
        <div class="item-main"><div class="item-title" style="font-size:14px">${esc(t.title)}</div></div>
        <span class="badge ${t.type === 'paid' ? 'points' : 'duty'}">${t.type === 'paid' ? money(t.points) : 'ללא תשלום'}</span>
        <button class="link" onclick="quickAssignDeleteTemplate('${t.id}')">🗑️</button>
      </div>`).join('')
    : '<div class="empty">הרשימה ריקה — הוסיפו מטלה למטה</div>';
  return `<h3>📋 הקצאה מרשימת מטלות</h3>
    <div class="field"><label>למי מקצים</label><select id="qa-child" onchange="quickAssignState.assignedTo=this.value">${kidOpts}</select></div>
    <label style="font-size:13px;font-weight:700;color:var(--ink-soft);display:block;margin-bottom:6px">בחרו מהרשימה</label>
    <div class="card" style="max-height:220px;overflow-y:auto;padding:6px 10px">${rows}</div>
    <div class="spacer"></div>
    <div class="field">
      <label>הוספת מטלה חדשה לרשימה</label>
      <div class="field-row">
        <input id="qa-new-title" placeholder="שם המטלה" value="${esc(s.newTitle)}" oninput="quickAssignState.newTitle=this.value" style="flex:2" />
        <select id="qa-new-type" onchange="quickAssignState.newType=this.value; quickAssignRefresh()" style="flex:1">
          <option value="duty" ${s.newType === 'duty' ? 'selected' : ''}>חובה</option>
          <option value="paid" ${s.newType === 'paid' ? 'selected' : ''}>בתשלום</option>
        </select>
      </div>
      ${s.newType === 'paid' ? `<input id="qa-new-points" type="number" min="0" placeholder="סכום (₪)" value="${s.newPoints}" oninput="quickAssignState.newPoints=Number(this.value)||0" style="margin-top:8px" />` : ''}
      <button class="link" style="margin-top:10px" onclick="quickAssignAddTemplate()">➕ הוספה לרשימה</button>
    </div>
    <div class="modal-actions">
      <button class="btn ghost" onclick="closeModal()">ביטול</button>
      <button class="btn primary" onclick="quickAssignSubmit()">הקצאה (${s.selected.size})</button>
    </div>`;
}
function quickAssignRefresh() { $('.modal').innerHTML = renderQuickAssign(); }
function quickAssignToggle(id, checked) {
  if (checked) quickAssignState.selected.add(id); else quickAssignState.selected.delete(id);
  quickAssignRefresh();
}
async function quickAssignAddTemplate() {
  const s = quickAssignState;
  if (!s.newTitle || s.newTitle.trim().length < 2) return toast('נא להזין שם מטלה', 'err');
  try {
    const created = await api('POST', '/tasks/templates', { title: s.newTitle.trim(), type: s.newType, points: s.newPoints });
    s.templates.push(created);
    s.newTitle = ''; s.newPoints = 0;
    quickAssignRefresh();
    toast('נוסף לרשימה', 'ok');
  } catch (err) { toast(err.message, 'err'); }
}
async function quickAssignDeleteTemplate(id) {
  if (!confirm('להסיר את המטלה מהרשימה הקבועה?')) return;
  try {
    await api('DELETE', '/tasks/templates/' + id);
    quickAssignState.templates = quickAssignState.templates.filter((t) => t.id !== id);
    quickAssignState.selected.delete(id);
    quickAssignRefresh();
  } catch (err) { toast(err.message, 'err'); }
}
async function quickAssignSubmit() {
  const s = quickAssignState;
  if (!s.assignedTo) return toast('נא לבחור ילד/ה', 'err');
  if (!s.selected.size) return toast('נא לבחור לפחות מטלה אחת', 'err');
  try {
    await api('POST', '/tasks/assign-from-templates', { assignedTo: s.assignedTo, templateIds: Array.from(s.selected) });
    closeModal(); toast('המטלות הוקצו', 'ok'); viewTasks(); loadChampion();
  } catch (err) { toast(err.message, 'err'); }
}
async function taskSubmit(id) { await act(() => api('POST', `/tasks/${id}/submit`), 'סומן כבוצע ✓', viewTasks); }
async function taskApprove(id) { await act(() => api('POST', `/tasks/${id}/approve`), 'אושר! 🎉', () => { viewTasks(); loadChampion(); }); }
async function taskReject(id) {
  const note = prompt('הערה לילד (אופציונלי):') || '';
  await act(() => api('POST', `/tasks/${id}/reject`, { note }), 'הוחזר לביצוע', viewTasks);
}
async function taskDelete(id) {
  if (!confirm('למחוק את המטלה?')) return;
  await act(() => api('DELETE', '/tasks/' + id), 'נמחק', viewTasks);
}

/* ============================================================
   Allowance (דמי כיס)
   ============================================================ */
async function viewAllowance() {
  const view = $('#view');
  view.innerHTML = '<div class="empty">טוען…</div>';
  const balances = await api('GET', '/allowance/balances');
  if (isParent()) {
    $('#fab').innerHTML = `<div class="fab"><button class="btn primary" onclick="allowanceForm()">➕ תנועה</button></div>`;
  }
  if (!balances.length) { view.innerHTML = emptyState('💰', 'אין נתוני דמי כיס'); return; }
  view.innerHTML = `<div class="section-title">💰 יתרות</div>` +
    balances.map((b) => `<div class="card balance-card" style="cursor:pointer" onclick="allowanceDetail('${b.memberId}')">
      ${avatar(b, 'profile-avatar')}
      <div class="item-main"><div class="item-title">${esc(b.name)}</div><div class="item-sub">לחצו לפירוט תנועות</div></div>
      <div class="balance-amt ${b.balance < 0 ? 'neg' : 'pos'}">${money(b.balance)}</div>
    </div>`).join('');
}
async function allowanceDetail(memberId) {
  try {
    const d = await api('GET', '/allowance/' + memberId);
    const txns = d.transactions.length ? d.transactions.map((t) => `
      <div class="txn"><div>${esc(t.reason)}<div class="item-sub">${new Date(t.createdAt).toLocaleDateString('he-IL')}</div></div>
      <div class="amt ${t.amount < 0 ? 'neg' : 'pos'}">${t.amount < 0 ? '' : '+'}${money(t.amount)} ${isParent() ? `<button class="link" onclick="allowanceDelTxn('${t.id}','${memberId}')">✕</button>` : ''}</div></div>`).join('')
      : '<div class="empty">אין תנועות</div>';
    openModal(`<h3>דמי כיס — ${esc(d.name)}</h3>
      <div class="balance-amt ${d.balance < 0 ? 'neg' : 'pos'}" style="text-align:center;margin-bottom:12px">${money(d.balance)}</div>
      ${txns}
      <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">סגירה</button>
      ${isParent() ? `<button class="btn primary" onclick="closeModal();allowanceForm('${memberId}')">תנועה חדשה</button>` : ''}</div>`);
  } catch (err) { toast(err.message, 'err'); }
}
function allowanceForm(preMember) {
  const opts = state.members.map((m) => `<option value="${m.id}" ${preMember === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
  openModal(`<h3>תנועת דמי כיס</h3>
    <div class="field"><label>בן/בת משפחה</label><select id="a-member">${opts}</select></div>
    <div class="field"><label>סוג</label><select id="a-type"><option value="credit">זיכוי (+)</option><option value="debit">חיוב (−)</option></select></div>
    <div class="field"><label>סכום (₪)</label><input id="a-amount" type="number" min="0" step="0.5" /></div>
    <div class="field"><label>סיבה</label><input id="a-reason" placeholder="לדוגמה: דמי כיס שבועיים" /></div>
    <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">ביטול</button>
    <button class="btn primary" onclick="allowanceSave()">שמירה</button></div>`);
}
async function allowanceSave() {
  const body = {
    memberId: $('#a-member').value,
    type: $('#a-type').value,
    amount: Number($('#a-amount').value),
    reason: $('#a-reason').value.trim(),
  };
  if (!body.amount) return toast('נא להזין סכום', 'err');
  try { await api('POST', '/allowance', body); closeModal(); toast('נשמר', 'ok'); viewAllowance(); }
  catch (err) { toast(err.message, 'err'); }
}
async function allowanceDelTxn(id, memberId) {
  if (!confirm('למחוק את התנועה?')) return;
  try { await api('DELETE', '/allowance/txn/' + id); closeModal(); toast('נמחק', 'ok'); allowanceDetail(memberId); }
  catch (err) { toast(err.message, 'err'); }
}

/* ============================================================
   Shopping (קניות)
   ============================================================ */
async function viewShopping() {
  const view = $('#view');
  view.innerHTML = '<div class="empty">טוען…</div>';
  const items = await api('GET', '/shopping');
  $('#fab').innerHTML = `<div class="fab"><button class="btn primary" onclick="shopForm()">➕ פריט</button></div>`;
  const requested = items.filter((i) => i.status === 'requested');
  const approved = items.filter((i) => i.status === 'approved');
  const purchased = items.filter((i) => i.status === 'purchased');
  let html = '';
  if (requested.length) html += `<div class="section-title">⏳ בקשות ${isParent() ? 'לאישור' : 'שלי'}</div><div class="card">${requested.map(shopRow).join('')}</div>`;
  if (approved.length) html += `<div class="section-title">🛒 לקנייה</div><div class="card">${approved.map(shopRow).join('')}</div>`;
  if (purchased.length) html += `<div class="section-title">✅ נקנו</div><div class="card">${purchased.slice(0, 15).map(shopRow).join('')}</div>`;
  view.innerHTML = html || emptyState('🛒', 'הרשימה ריקה', 'הוסיפו פריט עם הכפתור למטה');
}
function shopRow(i) {
  let actions = '';
  if (isParent() && i.status === 'requested') {
    actions += `<button class="btn green sm" onclick="shopApprove('${i.id}')">אשר</button>`;
    actions += `<button class="btn outline sm" onclick="shopReject('${i.id}')">דחה</button>`;
  }
  if (i.status === 'approved') {
    actions += `<button class="btn green sm" onclick="shopBought('${i.id}')">נקנה ✓</button>`;
  }
  if (isParent() || (i.requestedBy === state.me.id && i.status === 'requested')) {
    actions += `<button class="btn ghost sm" onclick="shopDelete('${i.id}')">🗑️</button>`;
  }
  const sub = [i.qty ? 'כמות: ' + esc(i.qty) : null, 'ביקש/ה: ' + esc(memberName(i.requestedBy)), i.note ? esc(i.note) : null].filter(Boolean).join(' · ');
  const label = { requested: 'ממתין', approved: 'לקנייה', purchased: 'נקנה', rejected: 'נדחה' }[i.status];
  return `<div class="item"><div class="avatar-sm" style="background:#eef2ff;color:#3b5bdb">🛒</div>
    <div class="item-main"><div class="item-title">${esc(i.name)}</div><div class="item-sub">${sub}</div></div>
    <div class="item-actions"><span class="badge ${i.status}">${label}</span>${actions}</div></div>`;
}
function shopForm() {
  openModal(`<h3>הוספת פריט${isParent() ? '' : ' (בקשה)'}</h3>
    <div class="field"><label>מוצר</label><input id="s-name" placeholder="לדוגמה: קורנפלקס" /></div>
    <div class="field-row"><div class="field"><label>כמות</label><input id="s-qty" placeholder="1" /></div></div>
    <div class="field"><label>הערה</label><input id="s-note" placeholder="מותג מועדף וכו'" /></div>
    ${isParent() ? '' : '<div class="item-sub" style="margin-bottom:8px">הבקשה תישלח להורה לאישור.</div>'}
    <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">ביטול</button>
    <button class="btn primary" onclick="shopSave()">${isParent() ? 'הוספה' : 'שליחת בקשה'}</button></div>`);
}
async function shopSave() {
  const body = { name: $('#s-name').value.trim(), qty: $('#s-qty').value.trim(), note: $('#s-note').value.trim() };
  if (!body.name) return toast('נא להזין שם מוצר', 'err');
  try { await api('POST', '/shopping', body); closeModal(); toast(isParent() ? 'נוסף' : 'הבקשה נשלחה', 'ok'); viewShopping(); }
  catch (err) { toast(err.message, 'err'); }
}
async function shopApprove(id) { await act(() => api('POST', `/shopping/${id}/approve`), 'אושר', viewShopping); }
async function shopReject(id) { await act(() => api('POST', `/shopping/${id}/reject`), 'נדחה', viewShopping); }
async function shopBought(id) { await act(() => api('POST', `/shopping/${id}/purchased`), 'סומן כנקנה', viewShopping); }
async function shopDelete(id) { if (!confirm('למחוק?')) return; await act(() => api('DELETE', '/shopping/' + id), 'נמחק', viewShopping); }

/* ============================================================
   Surveys (סקרים)
   ============================================================ */
async function viewSurveys() {
  const view = $('#view');
  view.innerHTML = '<div class="empty">טוען…</div>';
  const surveys = await api('GET', '/surveys');
  $('#fab').innerHTML = `<div class="fab"><button class="btn primary" onclick="surveyForm()">➕ סקר</button></div>`;
  if (!surveys.length) { view.innerHTML = emptyState('📊', 'אין סקרים', 'צרו סקר להחלטה משפחתית'); return; }
  view.innerHTML = surveys.map(surveyCard).join('');
}
function surveyCard(s) {
  const closed = s.status === 'closed';
  const opts = s.options.map((o) => `
    <div class="vote-opt ${s.myVote === o.id ? 'mine' : ''}" ${closed ? '' : `onclick="vote('${s.id}','${o.id}')"`}>
      <div class="bar" style="width:${o.percent}%"></div>
      <div class="lbl"><span>${esc(o.text)} ${s.myVote === o.id ? '✓' : ''}</span><span>${o.votes} (${o.percent}%)</span></div>
    </div>`).join('');
  const canManage = isParent() || s.createdBy === state.me.id;
  return `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <div class="item-title" style="font-size:16px">${esc(s.question)}</div>
      ${closed ? '<span class="badge closed">סגור</span>' : ''}
    </div>
    <div class="item-sub" style="margin:2px 0 10px">${esc(memberName(s.createdBy))} · ${s.totalVotes} הצבעות</div>
    ${opts}
    ${canManage ? `<div class="modal-actions">${closed ? '' : `<button class="btn outline sm" onclick="surveyClose('${s.id}')">סגור סקר</button>`}<button class="btn ghost sm" onclick="surveyDelete('${s.id}')">מחיקה</button></div>` : ''}
  </div>`;
}
let surveyOpts = [];
function surveyForm() {
  surveyOpts = ['', ''];
  openModal(renderSurveyForm());
}
function renderSurveyForm() {
  const optInputs = surveyOpts.map((v, i) => `<div class="field-row"><div class="field"><input class="s-opt" data-i="${i}" value="${esc(v)}" placeholder="אפשרות ${i + 1}" oninput="surveyOptChange(${i}, this.value)" /></div>${surveyOpts.length > 2 ? `<button class="btn ghost" onclick="surveyOptRemove(${i})">✕</button>` : ''}</div>`).join('');
  return `<h3>סקר חדש</h3>
    <div class="field"><label>שאלה</label><input id="sv-q" value="${esc(window._svq || '')}" placeholder="לדוגמה: איזה סרט בערב משפחתי?" oninput="window._svq=this.value" /></div>
    <label style="font-size:13px;font-weight:700;color:#5b647a">אפשרויות</label>
    ${optInputs}
    <button class="link" onclick="surveyOptAdd()">➕ הוסף אפשרות</button>
    <div class="modal-actions"><button class="btn ghost" onclick="closeModal();window._svq=''">ביטול</button>
    <button class="btn primary" onclick="surveySave()">יצירה</button></div>`;
}
function refreshSurveyForm() { $('.modal').innerHTML = renderSurveyForm(); }
function surveyOptChange(i, v) { surveyOpts[i] = v; }
function surveyOptAdd() { if (surveyOpts.length < 8) { surveyOpts.push(''); refreshSurveyForm(); } }
function surveyOptRemove(i) { surveyOpts.splice(i, 1); refreshSurveyForm(); }
async function surveySave() {
  const question = (window._svq || '').trim();
  const options = surveyOpts.map((o) => o.trim()).filter(Boolean);
  if (question.length < 3) return toast('נא להזין שאלה', 'err');
  if (options.length < 2) return toast('נדרשות לפחות 2 אפשרויות', 'err');
  try { await api('POST', '/surveys', { question, options }); window._svq = ''; closeModal(); toast('הסקר נוצר', 'ok'); viewSurveys(); }
  catch (err) { toast(err.message, 'err'); }
}
async function vote(id, optId) { await act(() => api('POST', `/surveys/${id}/vote`, { optionId: optId }), 'הצבעתך נקלטה', viewSurveys); }
async function surveyClose(id) { await act(() => api('POST', `/surveys/${id}/close`), 'הסקר נסגר', viewSurveys); }
async function surveyDelete(id) { if (!confirm('למחוק את הסקר?')) return; await act(() => api('DELETE', '/surveys/' + id), 'נמחק', viewSurveys); }

/* ============================================================
   Family / Settings
   ============================================================ */
async function viewFamily() {
  const view = $('#view');
  state.members = await api('GET', '/auth/members');
  let membersHtml = '';
  if (isParent()) {
    membersHtml = `<div class="section-title">👪 בני המשפחה</div><div class="card">` +
      state.members.map((m) => `<div class="item">${avatar(m)}
        <div class="item-main"><div class="item-title">${esc(m.name)} ${m.role === 'parent' ? '👑' : ''}</div>
        <div class="item-sub">${m.role === 'parent' ? 'הורה' : 'ילד/ה'}${m.role === 'child' ? ' · חודשי: ' + money(m.monthlyAllowance || 0) + ' · גלוי לאחים: ' + (m.allowanceVisibleToSiblings ? 'כן' : 'לא') : ''}</div></div>
        <div class="item-actions"><button class="btn ghost sm" onclick="memberForm('${m.id}')">עריכה</button></div></div>`).join('') +
      `</div><button class="btn primary block" onclick="memberForm()">➕ הוסף בן/בת משפחה</button>`;
  }
  view.innerHTML = `
    <div class="section-title">הפרופיל שלי</div>
    <div class="card balance-card">${avatar(state.me, 'profile-avatar')}
      <div class="item-main"><div class="item-title">${esc(state.me.name)}</div>
      <div class="item-sub">${isParent() ? 'הורה מנהל' : 'ילד/ה'}</div></div></div>
    <button class="btn outline block" onclick="changePinForm()">🔑 שינוי קוד PIN</button>
    <div class="spacer"></div>
    ${membersHtml}
    <div class="spacer"></div><div class="spacer"></div>
    <button class="btn red block" onclick="logout()">יציאה</button>`;
}
function memberForm(id) {
  const m = id ? memberById(id) : null;
  const emojiPick = EMOJIS.map((e) => `<button type="button" class="pin-key" style="padding:8px;font-size:20px" onclick="pickEmoji('${e}')">${e}</button>`).join('');
  openModal(`<h3>${m ? 'עריכת בן משפחה' : 'הוספת בן משפחה'}</h3>
    <div class="field"><label>שם</label><input id="m-name" value="${m ? esc(m.name) : ''}" /></div>
    <div class="field"><label>תפקיד</label><select id="m-role" onchange="document.getElementById('m-allowance-wrap').classList.toggle('hidden', this.value==='parent')">
      <option value="child" ${m && m.role === 'child' ? 'selected' : ''}>ילד/ה</option>
      <option value="parent" ${m && m.role === 'parent' ? 'selected' : ''}>הורה</option></select></div>
    <div class="field"><label>אימוג'י</label><input id="m-emoji" value="${m ? esc(m.emoji) : '🧒'}" style="width:70px;text-align:center;font-size:22px" readonly />
      <div class="pin-pad" style="grid-template-columns:repeat(8,1fr);margin-top:8px">${emojiPick}</div></div>
    <div class="field"><label>טלפון להתראות WhatsApp (אופציונלי)</label><input id="m-phone" type="tel" inputmode="tel" value="${m && m.phone ? esc(m.phone) : ''}" placeholder="050-0000000" /></div>
    <div id="m-allowance-wrap" class="field ${m && m.role === 'parent' ? 'hidden' : ''}">
      <label>דמי כיס חודשיים קבועים (₪) <span class="optional">— ייזקפו אוטומטית בכל ראש חודש עברי</span></label>
      <input id="m-allowance" type="number" min="0" value="${m ? (m.monthlyAllowance || 0) : 0}" />
    </div>
    <div class="checkbox-row"><input type="checkbox" id="m-vis" ${m && m.allowanceVisibleToSiblings ? 'checked' : ''} />
      <label for="m-vis">דמי הכיס גלויים לאחים/אחיות</label></div>
    <div class="field"><label>${m ? 'איפוס קוד PIN (השאר ריק כדי לא לשנות)' : 'קוד PIN (4-8 ספרות)'}</label><input id="m-pin" type="password" inputmode="numeric" placeholder="••••" /></div>
    <div class="modal-actions">
      ${m && m.id !== state.me.id ? `<button class="btn red" onclick="memberDelete('${m.id}')">מחיקה</button>` : ''}
      <button class="btn ghost" onclick="closeModal()">ביטול</button>
      <button class="btn primary" onclick="memberSave('${m ? m.id : ''}')">שמירה</button>
    </div>`);
}
function pickEmoji(e) { $('#m-emoji').value = e; }
async function memberSave(id) {
  const body = {
    name: $('#m-name').value.trim(),
    role: $('#m-role').value,
    emoji: $('#m-emoji').value,
    phone: $('#m-phone').value.trim(),
    monthlyAllowance: Number($('#m-allowance').value) || 0,
    allowanceVisibleToSiblings: $('#m-vis').checked,
  };
  const pin = $('#m-pin').value.trim();
  if (pin) body.pin = pin;
  if (body.name.length < 2) return toast('נא להזין שם', 'err');
  try {
    if (id) await api('PATCH', '/auth/members/' + id, body);
    else {
      if (!/^\d{4,8}$/.test(pin)) return toast('קוד PIN חייב 4-8 ספרות', 'err');
      await api('POST', '/auth/members', body);
    }
    closeModal(); toast('נשמר', 'ok'); viewFamily();
  } catch (err) { toast(err.message, 'err'); }
}
async function memberDelete(id) {
  if (!confirm('למחוק את בן המשפחה?')) return;
  try { await api('DELETE', '/auth/members/' + id); closeModal(); toast('נמחק', 'ok'); viewFamily(); }
  catch (err) { toast(err.message, 'err'); }
}
function changePinForm() {
  openModal(`<h3>שינוי קוד PIN</h3>
    <div class="field"><label>קוד נוכחי</label><input id="cp-cur" type="password" inputmode="numeric" /></div>
    <div class="field"><label>קוד חדש (4-8 ספרות)</label><input id="cp-new" type="password" inputmode="numeric" /></div>
    <div class="modal-actions"><button class="btn ghost" onclick="closeModal()">ביטול</button>
    <button class="btn primary" onclick="changePinSave()">שמירה</button></div>`);
}
async function changePinSave() {
  try {
    await api('POST', '/auth/change-pin', { currentPin: $('#cp-cur').value.trim(), newPin: $('#cp-new').value.trim() });
    closeModal(); toast('הקוד עודכן', 'ok');
  } catch (err) { toast(err.message, 'err'); }
}

/* ---------- shared helpers ---------- */
function emptyState(ico, title, sub) {
  return `<div class="card empty"><span class="big">${ico}</span><div style="font-weight:700">${title}</div>${sub ? `<div>${sub}</div>` : ''}</div>`;
}
async function act(fn, okMsg, then) {
  try { await fn(); toast(okMsg, 'ok'); if (then) then(); }
  catch (err) { toast(err.message, 'err'); }
}

boot();
