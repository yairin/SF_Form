'use strict';

/**
 * התראות WhatsApp דרך WhatsApp Cloud API (Meta Graph API).
 *
 * הגדרה (משתני סביבה):
 *   WHATSAPP_TOKEN     — access token קבוע של אפליקציית ה-WhatsApp Business
 *   WHATSAPP_PHONE_ID  — מזהה מספר הטלפון השולח (Phone Number ID)
 *   WHATSAPP_API_VERSION (אופציונלי, ברירת מחדל v20.0)
 *
 * אם ההגדרות חסרות — ההודעות רק נרשמות ל-console (מצב "dry run"),
 * כך שהמערכת פועלת גם ללא WhatsApp ומאפשרת בדיקות מקומיות.
 *
 * הערה: שליחת הודעות טקסט חופשי אפשרית בתוך חלון 24 השעות מאז הודעת
 * הלקוח האחרונה. ליזום מחוץ לחלון יש להשתמש בתבנית מאושרת (template).
 */

const GRAPH = 'https://graph.facebook.com';

function isConfigured() {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

// נירמול מספר לפורמט E.164 ללא סימנים (ברירת מחדל קידומת ישראל).
function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/[^\d+]/g, '');
  if (p.startsWith('+')) return p.slice(1);
  if (p.startsWith('00')) return p.slice(2);
  if (p.startsWith('0')) return '972' + p.slice(1); // מספר ישראלי מקומי
  return p;
}

async function sendText(phone, body) {
  const to = normalizePhone(phone);
  if (!to) return { ok: false, skipped: 'no-phone' };

  if (!isConfigured()) {
    console.log(`[whatsapp dry-run] → ${to}: ${body}`);
    return { ok: true, dryRun: true };
  }

  const version = process.env.WHATSAPP_API_VERSION || 'v20.0';
  const url = `${GRAPH}/${version}/${process.env.WHATSAPP_PHONE_ID}/messages`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { preview_url: false, body },
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[whatsapp] שגיאת שליחה ל-${to}: ${res.status} ${errText.slice(0, 300)}`);
      return { ok: false, status: res.status };
    }
    return { ok: true };
  } catch (err) {
    console.error(`[whatsapp] כשל ברשת בשליחה ל-${to}: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

// שולח לבן משפחה בודד (אם יש לו טלפון). לא זורק — התראות לא שוברות זרימה.
async function toMember(member, body) {
  if (!member || !member.phone) return;
  try { await sendText(member.phone, body); } catch (_) {}
}

// שולח לרשימת בני משפחה.
async function toMembers(members, body) {
  await Promise.all((members || []).map((m) => toMember(m, body)));
}

module.exports = { isConfigured, normalizePhone, sendText, toMember, toMembers };
