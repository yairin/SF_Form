# API ליצירת פניה מ-AI טלפוני → Salesforce

מימוש ל-API לפי מסמך "איפיון חיבור AI למערכת מוניפורס על מנת לייצר פניות". זהו API שרת-לשרת נפרד לגמרי מטופס ה-Web-to-Lead הקיים (`/api/submit`) — הוא יוצר רשומות ישירות ב-Salesforce דרך ה-REST API (`jsforce`), כולל Account, ContactPointPhone, Case וקבצים מצורפים.

## מבנה הקוד

```
src/
├── config.js                    # כל משתני הסביבה במקום אחד
├── constants.js                 # ערכי הפיקליסטים מהמסמך
├── salesforceClient.js          # חיבור jsforce משותף (login פעם אחת, retry על session שפג)
├── validation.js                 # ולידציה על ה-payload הנכנס
├── middleware/auth.js           # אימות Bearer JWT
├── routes/
│   ├── auth.js                  # POST /oauth/token (client_credentials)
│   └── cases.js                 # POST /api/cases (הפעולה המרכזית)
└── services/
    ├── accountService.js        # find-or-create ל-Account (Person Account) ו-ContactPointPhone
    ├── caseService.js           # בדיקת כפילות + יצירת Case
    └── attachmentService.js     # העלאת תמלול/הקלטה כ-Files מקושרים לפניה
```

## זרימת `POST /api/cases`

1. אימות: `Authorization: Bearer <token>` (הטוקן מתקבל מ-`POST /oauth/token`, client_credentials).
2. ולידציה של השדות (ראה טבלת הבקשה למטה). כשל → `400` עם רשימת שגיאות.
3. אם הפונה לא אנונימי: איתור/יצירת Account לפי `IdentificationType__pc` + `IdNumber__pc`.
4. בדיקת כפילות (Idempotency): חיפוש פניה פתוחה (`IsClosed = false`) עבור אותו Account. אם נמצאה — מוחזר `duplicate: true` עם מספר הפניה והנושא, **בלי** ליצור פניה חדשה.
5. איתור/יצירת ContactPointPhone (קישור למספר הטלפון, כולל `IsPrimary` לפי הלוגיקה במסמך).
6. יצירת ה-Case (Subject עם prefix קבוע, Description עם שפה/זמנים/תקציר, Origin מקובע ל"טלפון").
7. תשובה מיידית ללקוח עם מספר הפניה — **לפני** העלאת קבצים מצורפים, כדי לא לפגוע ב-SLA. העלאת התמלול/ההקלטה מתבצעת ברקע (fire-and-forget, עם לוג בשגיאה).

## דוגמת בקשה

```json
POST /api/cases
Authorization: Bearer <token>

{
  "callId": "call-98765",
  "municipality": "0011t000...",
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
    "isBusinessPhone": false
  },
  "case": {
    "subject": "בור בכביש הרצל",
    "type": "service case",
    "description": "סיכום שיחה שנכתב ע\"י הבינה המלאכותית...",
    "categoryId": "<Salesforce record Id, אופציונלי>",
    "topicId": "<Salesforce record Id, אופציונלי>",
    "subtopicId": "<Salesforce record Id, אופציונלי>",
    "locationId": "<Salesforce record Id, אופציונלי>",
    "addressId": "<Salesforce record Id, אופציונלי>"
  },
  "attachments": {
    "transcriptText": "תמלול מלא של השיחה...",
    "recordingUrl": "https://.../recording.mp3"
  }
}
```

תשובות אפשריות:
- הצלחה: `{ "success": true, "duplicate": false, "caseId": "500...", "caseNumber": "00012345" }`
- כפילות: `{ "success": true, "duplicate": true, "existingCase": { "caseNumber": "...", "subject": "..." } }`
- שגיאת ולידציה: `400` `{ "success": false, "errors": [...], "code": "VALIDATION_ERROR" }`
- שגיאת Salesforce: `502` `{ "success": false, "error": "...", "code": "SF_ERROR", "routeToHuman": true }`

## החלטות עיצוב ופערים שדורשים אישור מנהל ה-ORG

המסמך המקורי מגדיר את רוב השדות במדויק, אבל משאיר כמה נקודות פתוחות. המימוש הנוכחי בנוי כך שהכל ניתן לקונפיגורציה (`.env`), אבל **אלה חייבים אימות לפני production**:

1. **שדות ה-Lookup על Case** (`RegulatoryAuthorizationType__r__IssuingDepartment__PrimaryType__c` וכו') — כפי שמופיעים במסמך המקורי נראים כמו נתיב יחסים ב-SOQL (`__r__`) ולא כשם API אמיתי של שדה לכתיבה. ב-`src/config.js` יש ברירת מחדל סבירה (`PrimaryType__c`, `IssuingDepartmentId__c`, `RegulatoryAuthorizationType__c`) — **יש לאמת מול Object Manager** את שמות ה-API האמיתיים ולעדכן ב-`.env`.
2. **CaseRoute__c** — המסמך עצמו קובע שזהו שדה שיתמלא ע"י אוטומציה (Flow) שתיבנה בתוך Salesforce, לא ע"י ה-AI. ה-API תומך בקבלת `caseRouteId` אם הוא כן יגיע, אך לא ממציא לוגיקת שיוך — זה תלוי בפיתוח ה-Flow בצד Salesforce.
3. **Location / Address** — אותו עיקרון: המסמך אומר שהתאמת השם שה-AI יספק לרשומה בפועל תתבצע ע"י אוטומציה בתוך Salesforce. ה-API כרגע מקבל רק `locationId`/`addressId` (Id ישיר) — אם ה-AI לא יכול לספק Id ישיר (רק שם טקסטואלי), צריך להחליט האם ה-Flow יעבוד על שדה טקסט זמני, ואם כן — מהו שם ה-API שלו.
4. **Person Account Record Type** — `SF_PERSON_ACCOUNT_RECORD_TYPE_ID` חובה כדי ש-`Account.create` יצליח כראוי; יש לאתר את ה-Id הנכון (Setup → Object Manager → Account → Record Types).
5. **CASE_TYPES / Origin** — הערכים `Info case` / `service case` הועתקו כלשונם מהמסמך (כולל חוסר האחידות ב-casing); ו-`טלפון` כערך Origin. מומלץ לאמת מול ה-picklist בפועל שאלה אכן הערכים המדויקים.
6. **טיפול בשגיאות** (שדה חובה חסר / ערך פיקליסט לא תקין / timeout מוניפורס) — המסמך המקורי מציין שאין הגדרה לכך. המימוש הנוכחי: ולידציה מקדימה מחזירה `400` עם פירוט; כל כשל אחר (כולל timeout מול Salesforce) מוחזר כ-`502 SF_ERROR` עם `routeToHuman: true`, כדי שהמערכת הטלפונית תדע להעביר למענה אנושי. יש לאשר שזו ההתנהגות הרצויה.
7. **SLA (תגובה תוך שנייה)** — עם קריאות API סינכרוניות מול Salesforce (חיפוש Account, חיפוש פניה פתוחה, יצירת/עדכון ContactPointPhone, יצירת Case) קשה להבטיח פחות משנייה בכל תרחיש; לכן העלאת הקבצים המצורפים מתבצעת אחרי מתן התשובה, לא לפניה.

## משתני סביבה חדשים

ראו `.env.example` — נוספו `SF_PERSON_ACCOUNT_RECORD_TYPE_ID`, `SF_CONTACT_POINT_OWNER_ID`, `SF_CASE_FIELD_*`, ו-`AI_CLIENT_ID`/`AI_CLIENT_SECRET`/`JWT_SECRET` (להנפקת טוקן OAuth למערכת ה-AI).

## ה-Sandbox אותר — `SF_LOGIN_URL` עודכן

אושר שה-Sandbox האמיתי הוא:
`https://localgovernmenteconomicserviceslt2--mashamdev.sandbox.lightning.force.com` (Lightning UI).

עבור חיבור API/login (jsforce), יש להשתמש בכתובת ה-My Domain המקבילה — `https://<domain>--<sandbox>.sandbox.my.salesforce.com` במקום `.lightning.force.com` — כלומר:
`https://localgovernmenteconomicserviceslt2--mashamdev.sandbox.my.salesforce.com`

זהו כרגע ברירת המחדל ב-`.env.example`. **זה עדיין לא נבדק בפועל** — עדיין חסרים username/password/security token (או Connected App consumer key/secret) כדי לבצע login אמיתי.

### חיבור לרשת מתוך סביבת הפיתוח הזו

ניסיתי לבדוק connectivity ל-domain הזה (`curl` פשוט, ללא credentials) מתוך סביבת ה-sandbox של הסשן הזה, וקיבלתי `403` מה-proxy היוצא (`gateway answered 403 to CONNECT — policy denial`). כלומר **הרשת של סביבת הפיתוח הזו חוסמת גישה ל-domains של salesforce.com**, ולכן אי אפשר לבדוק את החיבור בפועל מתוך הסשן הנוכחי — לא משנה אם ה-credentials נכונים או לא. בדיקת אינטגרציה אמיתית תצטרך לקרות מתוך סביבה שיש לה גישת רשת ל-Salesforce (למשל אחרי פריסה ל-Railway, או מ-laptop/סביבת CI עם גישה חיצונית רגילה).

## `GET /api/residents/:idNumber?idType=IsraeliID|Passport`

Endpoint נפרד לבדיקת תושב לפי ת"ז/דרכון, בלי לפתוח פניה — תואם לסעיף "העברת מידע מזהה (ת״ז)" במסמך: "הבינה המלאכותית תפנה עם ת"ז למערכת סיילספורס באמצעות API, שתחזיר פרטים על התושב". מאפשר ל-AI לפנות לתושב בשמו ולהזהיר על פניה פתוחה קיימת **באמצע השיחה**, לפני שהוחלט אם ואיך לפתוח פניה חדשה — בנוסף לבדיקת הכפילות המובנית בתוך `POST /api/cases` עצמו.

תשובה (נמצא): `{ "success": true, "found": true, "resident": { "firstName", "lastName", "callerType", "municipality" }, "openCase": { "caseNumber", "subject" } | null }`
תשובה (לא נמצא): `{ "success": true, "found": false }`
