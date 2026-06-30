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
  firstName: (v) => v.trim().length >= 2 ? '' : 'שם פרטי נדרש (לפחות 2 תווים)',
  lastName:  (v) => v.trim().length >= 2 ? '' : 'שם משפחה נדרש (לפחות 2 תווים)',
  email:     (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'כתובת אימייל לא תקינה',
  subject:   (v) => v.trim().length >= 3 ? '' : 'נושא נדרש (לפחות 3 תווים)',
  message:   (v) => v.trim().length >= 10 ? '' : 'אנא פרט את פנייתך (לפחות 10 תווים)',
};

const stepFields = {
  1: ['firstName', 'lastName', 'email'],
  2: ['subject', 'message'],
};

function validateStep(step) {
  let ok = true;
  (stepFields[step] || []).forEach((field) => {
    const el = document.getElementById(field);
    const msg = validators[field](el.value);
    showFieldError(field, msg);
    if (msg) { ok = false; if (ok === false) el.focus(); }
  });
  return ok;
}

function showFieldError(field, msg) {
  const errEl = document.getElementById(`err-${field}`);
  const input = document.getElementById(field);
  if (errEl) errEl.textContent = msg;
  if (input) input.classList.toggle('error', !!msg);
}

// Clear error on input
document.addEventListener('DOMContentLoaded', () => {
  Object.keys(validators).forEach((field) => {
    const el = document.getElementById(field);
    if (el) el.addEventListener('input', () => showFieldError(field, ''));
  });

  // Char counter for message
  const msgEl = document.getElementById('message');
  const counter = document.getElementById('char-count');
  if (msgEl && counter) {
    msgEl.addEventListener('input', () => {
      const len = msgEl.value.length;
      counter.textContent = `${len} / 2000`;
      if (len > 2000) msgEl.value = msgEl.value.slice(0, 2000);
    });
  }

  // Form submit
  document.getElementById('main-form').addEventListener('submit', handleSubmit);
});

// ── Summary ───────────────────────────────────────────────────────────────────

const ratingLabels = { Cold: 'רגיל', Warm: 'בינוני', Hot: 'דחוף' };

function buildSummary() {
  const vals = getFormValues();
  const rows = [
    ['שם', `${vals.firstName} ${vals.lastName}`],
    ['אימייל', vals.email],
    vals.phone   ? ['טלפון', vals.phone]   : null,
    vals.company ? ['ארגון', vals.company] : null,
    ['נושא', vals.subject],
    ['הודעה', vals.message],
    ['דחיפות', ratingLabels[vals.rating] || vals.rating],
  ].filter(Boolean);

  document.getElementById('summary-box').innerHTML = rows
    .map(([l, v]) => `<div class="summary-row"><span class="label">${l}:</span><span class="value">${escHtml(v)}</span></div>`)
    .join('');
}

function getFormValues() {
  return {
    firstName: document.getElementById('firstName').value,
    lastName:  document.getElementById('lastName').value,
    email:     document.getElementById('email').value,
    phone:     document.getElementById('phone').value,
    company:   document.getElementById('company').value,
    subject:   document.getElementById('subject').value,
    message:   document.getElementById('message').value,
    rating:    document.querySelector('input[name="rating"]:checked')?.value || 'Cold',
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
  label.textContent = 'שולח...';
  spinner.classList.remove('hidden');
  errorBanner.classList.add('hidden');

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getFormValues()),
    });

    const data = await res.json();

    if (data.success) {
      document.getElementById('form-card').classList.add('hidden');
      document.getElementById('success-card').classList.remove('hidden');
      if (data.id) {
        document.getElementById('ref-id').textContent = `מספר פנייה: ${data.id}`;
      }
    } else {
      const msg = data.errors ? data.errors.join(' | ') : (data.error || 'שגיאה לא ידועה');
      showError(msg);
    }
  } catch {
    showError('שגיאת תקשורת. בדוק את החיבור ונסה שוב.');
  } finally {
    btn.disabled = false;
    label.textContent = 'שלח פנייה';
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
