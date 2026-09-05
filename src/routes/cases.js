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

      // ContactPointPhone came back NOT_FOUND against the real sandbox (confirmed via
      // discover-sf-schema) — the object isn't present/enabled in this org, despite
      // the source spec describing it. Non-fatal: log and continue rather than
      // blocking case creation on a step this org can't currently support. Needs
      // follow-up with the org admin on where the phone number should actually live.
      try {
        await findOrCreateContactPointPhone({ accountId, phone, municipal: municipality });
      } catch (err) {
        console.warn('ContactPointPhone step skipped (object unavailable in this org):', err.message);
      }
    }

    const created = await createCase({
      accountId,
      idType: caller.idType,
      idNumber: caller.idNumber,
      subject: kase.subject,
      type: kase.type,
      language,
      callReceivedAt,
      openedAt,
      summary: kase.description,
      municipal: municipality,
      category: kase.category,
      topic: kase.topic,
      subtopic: kase.subtopic,
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
