const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { findAccountByIdentification } = require('../services/accountService');
const { findOpenCaseForAccount } = require('../services/caseService');
const { IDENTIFICATION_TYPES } = require('../constants');

const router = express.Router();

// Lookup-only endpoint, separate from case creation, so the AI can greet a
// returning resident by name and warn about an existing open case mid-call —
// per the spec's "העברת מידע מזהה" section: the AI sends the ID number to this
// API and gets resident details back, without the ID itself ever reaching the
// AI provider's own storage.
router.get('/:idNumber', requireAuth, async (req, res) => {
  const { idNumber } = req.params;
  const { idType } = req.query;

  if (!IDENTIFICATION_TYPES.includes(idType)) {
    return res.status(400).json({
      success: false,
      error: `idType לא תקין (חייב להיות אחד מ: ${IDENTIFICATION_TYPES.join(', ')})`,
      code: 'VALIDATION_ERROR',
    });
  }

  try {
    const account = await findAccountByIdentification(idType, idNumber);
    if (!account) {
      return res.json({ success: true, found: false });
    }

    const openCase = await findOpenCaseForAccount(account.Id);

    res.json({
      success: true,
      found: true,
      resident: {
        firstName: account.FirstName,
        lastName: account.LastName,
        callerType: account.Type,
        municipality: account.Municipal__c,
      },
      openCase: openCase ? { caseNumber: openCase.CaseNumber, subject: openCase.Subject } : null,
    });
  } catch (err) {
    console.error('Resident lookup error:', err);
    res.status(502).json({ success: false, error: 'שגיאה באיתור התושב במערכת סיילספורס', code: 'SF_ERROR' });
  }
});

module.exports = router;
