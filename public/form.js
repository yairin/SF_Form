'use strict';

const slug = decodeURIComponent(location.pathname.replace(/^\/f\//, ''));
let schema = null;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fieldHtml(f) {
  const req = f.required ? ' <span class="req">*</span>' : '';
  const help = f.help ? `<div class="help">${esc(f.help)}</div>` : '';
  const ph = esc(f.placeholder || '');
  let control = '';
  if (f.type === 'textarea') {
    control = `<textarea name="${f.key}" placeholder="${ph}"></textarea>`;
  } else if (f.type === 'select') {
    control = `<select name="${f.key}"><option value="">— בחר —</option>${f.options.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`;
  } else if (f.type === 'radio') {
    control = f.options.map((o, i) => `<label class="choice"><input type="radio" name="${f.key}" value="${esc(o)}"${i === -1 ? '' : ''}/> ${esc(o)}</label>`).join('');
  } else if (f.type === 'checkboxGroup') {
    control = f.options.map((o) => `<label class="choice"><input type="checkbox" name="${f.key}" value="${esc(o)}"/> ${esc(o)}</label>`).join('');
  } else if (f.type === 'checkbox') {
    control = `<label class="choice"><input type="checkbox" name="${f.key}" value="כן"/> ${esc(f.label)}</label>`;
    return `<div data-field="${f.key}">${control}${help}</div>`;
  } else {
    const t = { email: 'email', phone: 'tel', number: 'number', date: 'date' }[f.type] || 'text';
    control = `<input type="${t}" name="${f.key}" placeholder="${ph}" />`;
  }
  return `<div data-field="${f.key}"><label>${esc(f.label)}${req}</label>${control}${help}</div>`;
}

function collect() {
  const form = document.getElementById('dynform');
  const body = {};
  for (const f of schema.fields) {
    if (f.type === 'checkboxGroup') {
      body[f.key] = [...form.querySelectorAll(`input[name="${CSS.escape(f.key)}"]:checked`)].map((el) => el.value);
    } else if (f.type === 'checkbox') {
      const el = form.querySelector(`input[name="${CSS.escape(f.key)}"]`);
      body[f.key] = el && el.checked ? el.value : '';
    } else if (f.type === 'radio') {
      const el = form.querySelector(`input[name="${CSS.escape(f.key)}"]:checked`);
      body[f.key] = el ? el.value : '';
    } else {
      const el = form.querySelector(`[name="${CSS.escape(f.key)}"]`);
      body[f.key] = el ? el.value : '';
    }
  }
  const hp = form.querySelector('input[name="_hp"]');
  if (hp) body._hp = hp.value;
  return body;
}

async function init() {
  try {
    const res = await fetch(`/api/forms/${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error('not found');
    schema = await res.json();
  } catch {
    document.getElementById('card').innerHTML = '<div class="ok"><h2>הטופס לא נמצא</h2></div>';
    return;
  }
  document.title = schema.title;
  document.getElementById('title').textContent = schema.title;
  document.getElementById('desc').textContent = schema.description || '';
  document.getElementById('fields').innerHTML = schema.fields.map(fieldHtml).join('');
}

document.getElementById('dynform').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('err');
  const btn = document.getElementById('submit');
  err.style.display = 'none';
  btn.disabled = true; btn.textContent = 'שולח…';
  try {
    const res = await fetch(`/api/forms/${encodeURIComponent(slug)}/submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(collect()),
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('card').innerHTML =
        `<div class="ok"><h2>נשלח בהצלחה!</h2><p>תודה, הפנייה התקבלה.</p><div class="ref">מספר סימוכין: ${esc(data.id)}</div></div>`;
    } else {
      err.innerHTML = (data.errors || [data.error || 'שגיאה']).map(esc).join('<br>');
      err.style.display = 'block';
    }
  } catch {
    err.textContent = 'שגיאת תקשורת. נסה שוב.';
    err.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'שליחה';
  }
});

init();
