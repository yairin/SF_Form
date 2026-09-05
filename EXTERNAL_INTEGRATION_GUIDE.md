# מדריך אינטגרציה לגורם חיצוני — פתיחת קריאות שירות ב-Sandbox

מסמך זה מיועד לשליחה **לגורם החיצוני** (ספק מערכת ה-AI הטלפונית) ומתאר איך להתחבר ל-API שלנו ולפתוח קריאת שירות. ה-API עצמו כבר ממומש בקוד (`src/routes/*`); המסמך הזה הוא הפרוטוקול הרשמי כלפי חוץ.

> **סטטוס נוכחי:** ה-API ממומש ונבדק מול שרת מקומי, אך **טרם חובר לסביבת Sandbox אמיתית של סיילספורס** וטרם פרוס בכתובת נגישה לגורם החיצוני. הסעיף "מה עדיין חסר מהצד שלנו" בסוף המסמך מפרט את זה. אין לשלוח את המסמך כפי שהוא בלי להשלים את הפרטים המסומנים `<TBD>`.

---

## 1. סקירה כללית

ה-API מאפשר לגורם החיצוני (מערכת AI המנהלת שיחות טלפוניות עם תושבים) לבצע שתי פעולות:

1. **זיהוי תושב** לפני פתיחת קריאה — `GET /api/residents/:idNumber`
2. **פתיחת קריאת שירות** — `POST /api/cases`

כל הבקשות הן HTTPS + JSON, ומאומתות באמצעות OAuth2 (`client_credentials`).

**עקרון מפתח:** מספר תעודת הזהות/דרכון של הפונה **לא אמור להישמר** אצל ספק ה-AI — הוא משמש רק לצורך הפנייה אלינו, ואנחנו מחזירים את הפרטים הרלוונטיים (שם, קריאה פתוחה קיימת וכו').

---

## 2. כתובת בסיס (Base URL)

| סביבה | כתובת |
|---|---|
| Sandbox | `<TBD — כתובת ה-Sandbox לאחר פריסה, לדוגמה https://sfform-sandbox.up.railway.app>` |
| Production | ייקבע בהמשך, לאחר אישור מלא ב-Sandbox |

כל הנתיבים במסמך זה יחסיים לכתובת הבסיס.

---

## 3. אימות (Authentication)

זרימת **OAuth2 client_credentials**. נספק לכם `client_id` + `client_secret` בערוץ מאובטח (לא במייל רגיל).

### קבלת Token

```
POST /oauth/token
Content-Type: application/json

{
  "grant_type": "client_credentials",
  "client_id": "<שיסופק>",
  "client_secret": "<שיסופק>"
}
```

**תשובה (200):**
```json
{
  "access_token": "<JWT>",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

יש לשלוח את ה-token בכל בקשה:
```
Authorization: Bearer <access_token>
```

לאחר פקיעת התוקף (`expires_in` שניות) יש לבקש token חדש. `401` על כל בקשה עם token חסר/פג תוקף/שגוי.

---

## 4. `GET /api/residents/:idNumber` — זיהוי תושב

שימוש: לפני או במהלך השיחה, כדי לזהות תושב חוזר ולבדוק אם יש לו כבר קריאה פתוחה — **בלי לפתוח קריאה חדשה**.

**Query param:** `idType` — `IsraeliID` או `Passport` (חובה)

```
GET /api/residents/123456789?idType=IsraeliID
Authorization: Bearer <token>
```

**תשובה — נמצא:**
```json
{
  "success": true,
  "found": true,
  "resident": {
    "firstName": "ישראל",
    "lastName": "ישראלי",
    "callerType": "Resident",
    "municipality": "<Municipal__c>"
  },
  "openCase": { "caseNumber": "00012345", "subject": "פניה טלפונית: בור בכביש" }
}
```
אם אין קריאה פתוחה: `"openCase": null`.

**תשובה — לא נמצא:**
```json
{ "success": true, "found": false }
```

**שגיאות:** `400` (idType לא תקין), `401` (אימות), `502` (שגיאת צד שלנו מול סיילספורס).

---

## 5. `POST /api/cases` — פתיחת קריאת שירות

```
POST /api/cases
Authorization: Bearer <token>
Content-Type: application/json
```

### גוף הבקשה

```json
{
  "callId": "call-98765",
  "municipality": "<ערך פיקליסט של Municipal__c>",
  "language": "עברית",
  "callReceivedAt": "2026-09-05T10:00:00Z",
  "caller": {
    "anonymous": false,
    "idType": "IsraeliID",
    "idNumber": "123456789",
    "firstName": "ישראל",
    "lastName": "ישראלי",
    "callerType": "Resident"
  },
  "phone": {
    "number": "0541111111",
    "isSmsCapable": true,
    "isPersonalPhone": true,
    "isBusinessPhone": false,
    "usageType": "Home",
    "usagePhone": "Mobile"
  },
  "case": {
    "subject": "בור בכביש הרצל",
    "type": "service case",
    "description": "סיכום שיחה (עד 1000 תווים)",
    "categoryId": "<Id של רשומת קטגוריה, אופציונלי>",
    "topicId": "<Id של רשומת נושא, אופציונלי>",
    "subtopicId": "<Id של רשומת תת-נושא, אופציונלי>",
    "locationId": "<Id של רשומת מיקום, אופציונלי>",
    "addressId": "<Id של רשומת כתובת, אופציונלי>"
  },
  "attachments": {
    "transcriptText": "תמלול מלא של השיחה",
    "recordingUrl": "https://.../recording.mp3"
  }
}
```

### הסברי שדות

| שדה | חובה? | הערות |
|---|---|---|
| `callId` | כן | מזהה חוץ-מערכתי של השיחה. משמש לתיוג הקבצים המצורפים לקריאה. |
| `municipality` | כן | קוד/ערך הרשות. |
| `language` | לא | ברירת מחדל "עברית". |
| `callReceivedAt` | לא | ISO datetime; נשמר בתיאור הקריאה. |
| `caller.anonymous` | לא | אם `true` — כל שאר שדות `caller`/`phone` לא נדרשים, הקריאה תיפתח כאנונימית וללא Account. |
| `caller.idType` | כן (אם לא אנונימי) | `IsraeliID` או `Passport` בלבד. |
| `caller.idNumber` / `firstName` / `lastName` | כן (אם לא אנונימי) | — |
| `caller.callerType` | לא | ערך פיקליסט (ראו טבלה בסעיף 6). ברירת מחדל: לא מוגדר. |
| `phone.number` | כן (אם לא אנונימי) | תבנית ישראלית, לדוגמה `0541111111`. |
| `phone.usageType` / `usagePhone` | לא | ראו טבלה בסעיף 6. |
| `case.subject` | כן | הנושא כפי שזוהה ע"י ה-AI, **בלי** את הקידומת — אנחנו מוסיפים אוטומטית "פניה טלפונית: " ומקצרים ל-255 תווים. |
| `case.type` | כן | `Info case` או `service case` בלבד (ראו הערה בסעיף 6). |
| `case.description` | כן | סיכום השיחה; מקוצר אוטומטית ל-1000 תווים בתוך התיאור המלא. |
| `case.categoryId`/`topicId`/`subtopicId`/`locationId`/`addressId` | לא | **חייבים להיות Id של רשומה קיימת בסיילספורס**, לא טקסט חופשי — הקטלוג יסופק לכם בנפרד. אם לא סופק — הקריאה עדיין נפתחת, ללא שיוך. |
| `attachments.transcriptText` | לא | קובץ טקסט יצורף לקריאה. |
| `attachments.recordingUrl` **או** `recordingBase64` | לא | מומלץ `recordingUrl` (קובץ מצורף נמשך מה-URL בצד שלנו) על פני שליחת base64 בגוף הבקשה — payload קטן יותר וזמן תגובה מהיר יותר. |

**חשוב — Origin נקבע אוטומטית:** לא ניתן לשלוח `origin` בבקשה; כל קריאה שנפתחת דרך API זה מסומנת אוטומטית כ-Origin = "טלפון".

### תשובות

**הצלחה (קריאה חדשה נפתחה):**
```json
{ "success": true, "duplicate": false, "caseId": "500...", "caseNumber": "00012345" }
```

**כפילות (לתושב כבר יש קריאה פתוחה — לא נפתחה קריאה נוספת):**
```json
{
  "success": true,
  "duplicate": true,
  "existingCase": { "caseNumber": "00012340", "subject": "פניה טלפונית: ..." }
}
```
במקרה זה יש להודיע לפונה שקיימת כבר קריאה פתוחה, בציון הנושא.

**שגיאת ולידציה (400):**
```json
{ "success": false, "errors": ["case.subject נדרש", "..."], "code": "VALIDATION_ERROR" }
```

**שגיאת מערכת (502):**
```json
{ "success": false, "error": "שגיאה ביצירת הפניה במערכת סיילספורס", "code": "SF_ERROR", "routeToHuman": true }
```
כאשר `routeToHuman: true` מוחזר — יש להעביר את הפונה למענה אנושי ולא לנסות שוב אוטומטית.

**אימות חסר/שגוי (401):**
```json
{ "success": false, "error": "Missing bearer token", "code": "UNAUTHORIZED" }
```

---

## 6. ערכי פיקליסט תקינים

**`caller.idType`:** `IsraeliID`, `Passport`

**`case.type`:** `Info case` (פניית מידע), `service case` (פניית שירות) — *כפי שהוגדר במסמך המקור; יש לאמת מול הארגון שאלה אכן הערכים המדויקים לפני production.*

**`phone.usageType`:** `Home`, `Work`, `Temporary`, `Other`

**`phone.usagePhone`:** `Home`, `Mobile`, `spouse`

**`caller.callerType`** (חלקי, הרשימה המלאה ב-`src/constants.js`): `Resident`, `Passerby`, `Visitor`, `Worker`, `Business Owner`, `Government Organization`, ועוד — ערכים שאינם ברשימה יידחו עם שגיאת ולידציה.

---

## 7. הגבלות קצב (Rate Limiting)

עד 120 בקשות לדקה (משותף בין `/oauth/token`, `/api/cases`, `/api/residents`). חריגה מוחזרת כ-`429` עם `{ "success": false, "error": "Too many requests", "code": "RATE_LIMITED" }`. אם הנפח הצפוי גבוה יותר — יש לתאם עדכון מגבלה.

## 8. גודל בקשה מקסימלי

עד 20MB לכל בקשת JSON (כדי לאפשר `recordingBase64`, אם כי מומלץ `recordingUrl` כאמור).

## 9. אבטחה

- כל תעבורה חייבת להיות דרך HTTPS בלבד.
- `client_secret` ו-`access_token` אינם אמורים להיחשף בלוגים בצד שלכם.
- אין להעביר את מספר תעודת הזהות של הפונה לשום גורם שלישי — רק בין המערכת שלכם לבין ה-API הזה.

---

## מה עדיין חסר מהצד שלנו (לפני שהמדריך הזה "אמיתי")

1. **פריסה לסביבת Sandbox נגישה** — כתובת הבסיס עדיין `<TBD>`.
2. **חיבור ל-Salesforce Sandbox אמיתי** — ה-API טרם הורץ מול ארגון אמיתי; ראו `ORG_INFO_REQUEST.md` ו-`API_IMPLEMENTATION_NOTES.md` לפערי מידע פתוחים (שמות שדות Lookup, Record Type של Person Account וכו').
3. **הנפקת `client_id`/`client_secret`** בפועל לגורם החיצוני.
4. **קטלוג הקטגוריות/נושאים/תתי-נושאים/מיקומים/כתובות** (עם ה-Id-ים) שצריך למסור לגורם החיצוני כדי שישתמש בהם בשדות `categoryId` וכו'.
5. **אימות ערכי הפיקליסט** בסעיף 6 מול הארגון בפועל.
6. **בדיקת קצה-לקצה** מלאה מול Sandbox אמיתי לפני שמסמך זה נשלח כסופי.
