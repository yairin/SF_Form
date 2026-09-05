const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validateCasePayload } = require('../validation');
const { findOrCreateAccount, findOrCreateContactPointPhone } = require('../services/accountService');
const { findOpenCaseForAccount, createCase } = require('../services/caseService');
const { attachCallFiles } = require('../services/attachmentService');

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  const errors = validateCasePayload(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors, code: 'VALIDATION_ERROR' });
  }

  const {
    callId,
    municipality,
    language,
    callReceivedAt,
    caller = {},
    phone = {},
    case: kase = {},
    attachments = {},
  } = req.body;
  const openedAt = new Date().toISOString();

  try {
    let accountId = null;

    if (!caller.anonymous) {
      const account = await findOrCreateAccount({
        idType: caller.idType,
        idNumber: caller.idNumber,
        firstName: caller.firstName,
        lastName: caller.lastName,
        callerType: caller.callerType,
        municipal: municipality,
      });
      accountId = account.id;

      // Idempotency: if this resident already has an open case, tell the caller
      // instead of opening a duplicate.
      const existingCase = await findOpenCaseForAccount(accountId);
      if (existingCase) {
        return res.json({
          success: true,
          duplicate: true,
          existingCase: { caseNumber: existingCase.CaseNumber, subject: existingCase.Subject },
        });
      }

      await findOrCreateContactPointPhone({ accountId, phone, municipal: municipality });
    }

    const created = await createCase({
      accountId,
      subject: kase.subject,
      type: kase.type,
      language,
      callReceivedAt,
      openedAt,
      summary: kase.description,
      municipal: municipality,
      categoryId: kase.categoryId,
      topicId: kase.topicId,
      subtopicId: kase.subtopicId,
      caseRouteId: kase.caseRouteId,
      locationId: kase.locationId,
      addressId: kase.addressId,
    });

    // Respond as soon as the Case exists; attach the transcript/recording in the
    // background so slow file uploads don't blow the ~1s SLA on the main call.
    res.json({ success: true, duplicate: false, caseId: created.id, caseNumber: created.caseNumber });

    if (attachments.transcriptText || attachments.recordingUrl || attachments.recordingBase64) {
      attachCallFiles(created.id, { callId, ...attachments }).catch((err) => {
        console.error(`Attachment upload failed for case ${created.id}:`, err.message);
      });
    }
  } catch (err) {
    console.error('Case creation error:', err);
    res.status(502).json({
      success: false,
      error: 'שגיאה ביצירת הפניה במערכת סיילספורס',
      code: 'SF_ERROR',
      routeToHuman: true,
    });
  }
});

module.exports = router;
