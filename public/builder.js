'use strict';

const TYPES = [
  ['text', 'טקסט קצר'], ['textarea', 'טקסט ארוך'], ['email', 'אימייל'], ['phone', 'טלפון'],
  ['number', 'מספר'], ['date', 'תאריך'], ['select', 'בחירה מרשימה'], ['radio', 'בחירה יחידה'],
  ['checkbox', 'תיבת סימון'], ['checkboxGroup', 'בחירה מרובה'],
];
const MAP = [['', '— ללא מיפוי —'], ['respondentName', 'שם'], ['email', 'אימייל'], ['phone', 'טלפון'], ['subject', 'נושא']];
const CHOICE = new Set(['select', 'radio', 'checkboxGroup']);

let fields = [];

function optionsHtml(list, sel) {
  return list.map(([v, l]) => `<option value="${v}"${v === sel ? ' selected' : ''}>${l}</option>`).join('');
}

function render() {
  const box = document.getElementById('fields');
  box.innerHTML = '';
  fields.forEach((f, i) => {
    const el = document.createElement('div');
    el.className = 'field';
    el.innerHTML = `
      <div class="field-top">
        <select data-i="${i}" data-p="type" style="max-width:170px">${optionsHtml(TYPES, f.type)}</select>
        <input type="text" data-i="${i}" data-p="label" placeholder="תווית השדה" value="${(f.label || '').replace(/"/g, '&quot;')}" />
        <label class="chk"><input type="checkbox" data-i="${i}" data-p="required" ${f.required ? 'checked' : ''}/> חובה</label>
        <button class="btn btn-ghost btn-sm" data-act="up" data-i="${i}">↑</button>
        <button class="btn btn-ghost btn-sm" data-act="down" data-i="${i}">↓</button>
        <button class="btn btn-danger btn-sm" data-act="del" data-i="${i}">מחק</button>
      </div>
      <div class="row" style="margin-top:8px">
        <div>
          <label>מיפוי לשדה מפתח ב-Salesforce</label>
          <select data-i="${i}" data-p="mapTo">${optionsHtml(MAP, f.mapTo || '')}</select>
        </div>
        <div class="opts ${CHOICE.has(f.type) ? 'show' : ''}">
          <label>אפשרויות (שורה לכל אפשרות)</label>
          <textarea data-i="${i}" data-p="options" placeholder="אפשרות 1&#10;אפשרות 2">${f.options || ''}</textarea>
        </div>
      </div>`;
    box.appendChild(el);
  });
}

// Update model from any input change
document.getElementById('fields').addEventListener('input', (e) => {
  const t = e.target, i = t.dataset.i, p = t.dataset.p;
  if (i === undefined || !p) return;
  fields[i][p] = t.type === 'checkbox' ? t.checked : t.value;
  if (p === 'type') render(); // toggle options visibility
});

document.getElementById('fields').addEventListener('click', (e) => {
  const act = e.target.dataset.act;
  if (!act) return;
  const i = Number(e.target.dataset.i);
  if (act === 'del') fields.splice(i, 1);
  if (act === 'up' && i > 0) [fields[i - 1], fields[i]] = [fields[i], fields[i - 1]];
  if (act === 'down' && i < fields.length - 1) [fields[i + 1], fields[i]] = [fields[i], fields[i + 1]];
  render();
});

document.getElementById('add-field').addEventListener('click', () => {
  fields.push({ type: 'text', label: '', required: false, options: '', mapTo: '' });
  render();
});

document.getElementById('save').addEventListener('click', async () => {
  const err = document.getElementById('err');
  const result = document.getElementById('result');
  err.style.display = 'none'; result.style.display = 'none';

  const payload = {
    title: document.getElementById('f-title').value,
    description: document.getElementById('f-desc').value,
    fields: fields.map((f) => ({
      ...f,
      options: CHOICE.has(f.type) ? String(f.options || '').split('\n').map((s) => s.trim()).filter(Boolean) : undefined,
    })),
  };

  try {
    const res = await fetch('/api/forms', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) {
      err.textContent = (data.errors || ['שגיאה']).join(' · ');
      err.style.display = 'block';
      return;
    }
    const url = `${location.origin}${data.url}`;
    result.innerHTML = `הטופס פורסם! קישור ציבורי אנונימי:<br><a href="${data.url}" target="_blank">${url}</a>`;
    result.style.display = 'block';
    loadForms();
  } catch {
    err.textContent = 'שגיאת תקשורת. נסה שוב.';
    err.style.display = 'block';
  }
});

async function loadForms() {
  const ul = document.getElementById('forms-list');
  try {
    const { forms: list } = await (await fetch('/api/forms')).json();
    ul.innerHTML = list.length
      ? list.map((f) => `<li><a href="/f/${f.slug}" target="_blank">${f.title}</a> <span class="muted">· ${f.fields} שדות · /f/${f.slug}</span></li>`).join('')
      : '<li class="muted">עדיין אין טפסים</li>';
  } catch {
    ul.innerHTML = '<li class="muted">שגיאה בטעינה</li>';
  }
}

// start with one field
fields.push({ type: 'text', label: '', required: true, options: '', mapTo: 'respondentName' });
render();
loadForms();
