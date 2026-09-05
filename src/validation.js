const { IDENTIFICATION_TYPES, ACCOUNT_TYPES, CASE_TYPES, USAGE_TYPES, USAGE_PHONES } = require('./constants');

function validateCasePayload(body) {
  const errors = [];
  const caller = body.caller || {};
  const phone = body.phone || {};
  const kase = body.case || {};

  if (!body.callId) errors.push('callId נדרש');
  if (!body.municipality) errors.push('municipality (רשות) נדרש');

  if (!caller.anonymous) {
    if (!IDENTIFICATION_TYPES.includes(caller.idType)) {
      errors.push(`caller.idType לא תקין (חייב להיות אחד מ: ${IDENTIFICATION_TYPES.join(', ')})`);
    }
    if (!caller.idNumber) errors.push('caller.idNumber נדרש עבור פונה מזוהה');
    if (!caller.firstName) errors.push('caller.firstName נדרש');
    if (!caller.lastName) errors.push('caller.lastName נדרש');
    if (caller.callerType && !ACCOUNT_TYPES.includes(caller.callerType)) {
      errors.push('caller.callerType אינו ערך פיקליסט תקין');
    }
    if (!phone.number || !/^0\d{8,9}$/.test(phone.number)) {
      errors.push('phone.number לא תקין (תבנית מספר ישראלי, לדוגמה 0541111111)');
    }
    if (phone.usageType && !USAGE_TYPES.includes(phone.usageType)) {
      errors.push('phone.usageType אינו ערך פיקליסט תקין');
    }
    if (phone.usagePhone && !USAGE_PHONES.includes(phone.usagePhone)) {
      errors.push('phone.usagePhone אינו ערך פיקליסט תקין');
    }
  }

  if (!kase.subject || !kase.subject.trim()) errors.push('case.subject נדרש');
  if (!Object.values(CASE_TYPES).includes(kase.type)) {
    errors.push(`case.type אינו ערך פיקליסט תקין (חייב להיות אחד מ: ${Object.values(CASE_TYPES).join(', ')})`);
  }
  if (!kase.description) errors.push('case.description נדרש');

  return errors;
}

module.exports = { validateCasePayload };
