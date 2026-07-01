'use strict';

let currentStep = 1;
const TOTAL_STEPS = 3;

// ── Step navigation ──────────────────────────────────────────────────────────

function nextStep(from) {
  if (!validateStep(from)) return;
  if (from === TOTAL_STEPS - 1) buildSummary();
  goToStep(from + 1);
}

function prevStep(from) {
  goToStep(from - 1);
}

function goToStep(n) {
  document.getElementById(`step-${currentStep}`).classList.remove('active');
  currentStep = n;
  document.getElementById(`step-${n}`).classList.add('active');
  updateStepIndicators();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateStepIndicators() {
  document.querySelectorAll('.step').forEach((el) => {
    const s = parseInt(el.dataset.step, 10);
    el.classList.toggle('active', s === currentStep);
    el.classList.toggle('done', s < currentStep);
    if (s < currentStep) {
      el.querySelector('.step-num').innerHTML = '✓';
    } else {
      el.querySelector('.step-num').textContent = s;
    }
  });
  document.querySelectorAll('.step-divider').forEach((el, i) => {
    el.classList.toggle('done', i + 1 < currentStep);
  });
}

// ── Validation ────────────────────────────────────────────────────────────────

const validators = {
  title:       (v) => v.trim().length >= 3 ? '' : 'כותרת האירוע נדרשת (לפחות 3 תווים)',
  type:        (v) => v ? '' : 'יש לבחור סוג אירוע',
  location:    (v) => v.trim().length >= 2 ? '' : 'מיקום האירוע נדרש',
  description: (v) => v.trim().length >= 10 ? '' : 'אנא פרט את תיאור האירוע (לפחות 10 תווים)',
  reporter:    (v) => v.trim().length >= 2 ? '' : 'שם המדווח נדרש',
  phone:       (v) => /^[\d\-+()\s]{7,20}$/.test(v.trim()) ? '' : 'מספר טלפון לא תקין',
  casualties:  (v) => v === '' || (Number.isInteger(Number(v)) && Number(v) >= 0) ? '' : 'מספר נפגעים לא תקין',
};

const stepFields = {
  1: ['title', 'type', 'location', 'description'],
  2: ['reporter', 'phone', 'casualties'],
};

function validateStep(step) {
  let ok = true;
  let firstBad = null;
  (stepFields[step] || []).forEach((field) => {
    const el = document.getElementById(field);
    const msg = validators[field](el.value);
    showFieldError(field, msg);
    if (msg) { ok = false; if (!firstBad) firstBad = el; }
  });
  if (firstBad) firstBad.focus();
  return ok;
}

function showFieldError(field, msg) {
  const errEl = document.getElementById(`err-${field}`);
  const input = document.getElementById(field);
  if (errEl) errEl.textContent = msg;
  if (input) input.classList.toggle('error', !!msg);
}

document.addEventListener('DOMContentLoaded', () => {
  Object.keys(validators).forEach((field) => {
    const el = document.getElementById(field);
    if (el) {
      const evt = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, () => showFieldError(field, ''));
    }
  });

  const descEl = document.getElementById('description');
  const counter = document.getElementById('char-count');
  if (descEl && counter) {
    descEl.addEventListener('input', () => {
      const len = descEl.value.length;
      counter.textContent = `${len} / 2000`;
      if (len > 2000) descEl.value = descEl.value.slice(0, 2000);
    });
  }

  document.getElementById('main-form').addEventListener('submit', handleSubmit);
});

// ── Summary ───────────────────────────────────────────────────────────────────

function buildSummary() {
  const vals = getFormValues();
  const rows = [
    ['כותרת', vals.title],
    ['סוג אירוע', vals.type],
    ['חומרה', vals.severity],
    ['מיקום', vals.location],
    ['תיאור', vals.description],
    vals.occurredAt ? ['מועד תחילה', formatDateTime(vals.occurredAt)] : null,
    vals.casualties !== '' ? ['מספר נפגעים', vals.casualties] : null,
    ['מדווח', vals.reporter],
    ['טלפון', vals.phone],
  ].filter(Boolean);

  document.getElementById('summary-box').innerHTML = rows
    .map(([l, v]) => `<div class="summary-row"><span class="label">${l}:</span><span class="value">${escHtml(String(v))}</span></div>`)
    .join('');
}

function formatDateTime(v) {
  const d = new Date(v);
  if (isNaN(d)) return v;
  return d.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
}

function getFormValues() {
  return {
    title:       document.getElementById('title').value,
    type:        document.getElementById('type').value,
    severity:    document.querySelector('input[name="severity"]:checked')?.value || 'בינונית',
    location:    document.getElementById('location').value,
    description: document.getElementById('description').value,
    occurredAt:  document.getElementById('occurredAt').value,
    casualties:  document.getElementById('casualties').value,
    reporter:    document.getElementById('reporter').value,
    phone:       document.getElementById('phone').value,
  };
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Submit ────────────────────────────────────────────────────────────────────

async function handleSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('submit-btn');
  const label = document.getElementById('submit-label');
  const spinner = document.getElementById('submit-spinner');
  const errorBanner = document.getElementById('error-banner');

  btn.disabled = true;
  label.textContent = 'פותח אירוע...';
  spinner.classList.remove('hidden');
  errorBanner.classList.add('hidden');

  try {
    const res = await fetch('/api/emergency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getFormValues()),
    });

    const data = await res.json();

    if (data.success) {
      document.getElementById('form-card').classList.add('hidden');
      document.getElementById('success-card').classList.remove('hidden');
      if (data.id) {
        document.getElementById('ref-id').textContent = `מזהה אירוע: ${data.id}`;
      }
    } else {
      const msg = data.errors ? data.errors.join(' | ') : (data.error || 'שגיאה לא ידועה');
      showError(msg);
    }
  } catch {
    showError('שגיאת תקשורת. בדוק את החיבור ונסה שוב.');
  } finally {
    btn.disabled = false;
    label.textContent = 'פתח אירוע חירום';
    spinner.classList.add('hidden');
  }
}

function showError(msg) {
  const el = document.getElementById('error-banner');
  el.textContent = msg;
  el.classList.remove('hidden');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Reset ─────────────────────────────────────────────────────────────────────

function resetForm() {
  document.getElementById('main-form').reset();
  document.getElementById('char-count').textContent = '0 / 2000';
  document.querySelectorAll('.field-error').forEach((el) => (el.textContent = ''));
  document.querySelectorAll('.error').forEach((el) => el.classList.remove('error'));
  document.getElementById('error-banner').classList.add('hidden');
  document.getElementById('ref-id').textContent = '';
  document.getElementById('success-card').classList.add('hidden');
  document.getElementById('form-card').classList.remove('hidden');
  currentStep = 1;
  document.querySelectorAll('.form-step').forEach((el) => el.classList.remove('active'));
  document.getElementById('step-1').classList.add('active');
  updateStepIndicators();
}
