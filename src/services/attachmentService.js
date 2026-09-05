const { withConnection } = require('../salesforceClient');

async function uploadFile(caseId, { fileName, base64Data, description }) {
  return withConnection(async (conn) => {
    const cv = await conn.sobject('ContentVersion').create({
      Title: fileName,
      PathOnClient: fileName,
      VersionData: base64Data,
      Description: description,
    });
    if (!cv.success) throw new Error(`File upload failed: ${JSON.stringify(cv.errors)}`);

    const contentVersion = await conn.sobject('ContentVersion').retrieve(cv.id);
    await conn.sobject('ContentDocumentLink').create({
      ContentDocumentId: contentVersion.ContentDocumentId,
      LinkedEntityId: caseId,
      ShareType: 'V',
    });
  });
}

async function fetchAsBase64(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download file from ${url}: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString('base64');
}

// Best-effort: attaches the transcript and recording to the case, tagging both
// with the external Call ID per spec ("מזהה חוץ-מערכתי / Call ID ... יצוין בתיאור").
// Called without blocking the case-creation response — see routes/cases.js.
async function attachCallFiles(caseId, { callId, transcriptText, recordingUrl, recordingBase64 }) {
  const description = `Call ID: ${callId}`;

  if (transcriptText) {
    const base64 = Buffer.from(transcriptText, 'utf-8').toString('base64');
    await uploadFile(caseId, { fileName: `transcript-${callId}.txt`, base64Data: base64, description });
  }

  if (recordingBase64 || recordingUrl) {
    const base64 = recordingBase64 || (await fetchAsBase64(recordingUrl));
    await uploadFile(caseId, { fileName: `recording-${callId}.mp3`, base64Data: base64, description });
  }
}

module.exports = { attachCallFiles };
