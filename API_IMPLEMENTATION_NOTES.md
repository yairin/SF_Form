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
  "municipality": "634",
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
    "category": "Infrastructure - 634",
    "topic": "Roads and sidewalks - 634",
    "subtopic": "Pit in the road / pothole - 634",
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

## ✅ הסכימה אושרה מול ה-Sandbox האמיתי (2026-09-06, `npm run discover-sf-schema`)

הרצה מוצלחת מול הסנדבוקס האמיתי חשפה כמה דברים שהמסמך המקורי ניחש לא נכון, ותוקנו בקוד:

- **`Case.Origin` = `"Phone"` (אנגלית), לא `"טלפון"`.** הניחוש המקורי היה שגוי לגמרי — `src/constants.js` תוקן. זה היה באג שהיה שובר כל יצירת Case.
- **Category/Topic/Sub-Topic הם פיקליסטים רגילים, לא Lookup.** שמות ה-API האמיתיים: `Category__c`, `Topic__c`, `Sub_Topic__c` (לא `RegulatoryAuthorizationType__r__...` כפי שהמסמך המקורי רמז). הערכים כוללים סיומת רשות, למשל `"Infrastructure - 634"` — כלומר כל רשות רואה קטלוג ערכים שונה. ה-API כעת מקבל את אלה כמחרוזת חופשית (`case.category`/`case.topic`/`case.subtopic`) ומעביר ישירות ל-Salesforce, בלי לאמת מול רשימה סגורה (כי היא תלוית-רשות).
- **`CaseRoute__c`, `Location__c`, `Address__c` — כולם מאושרים כשמות API נכונים** (Lookup fields, `CaseRoute__c`/`Location`/`Address` בהתאמה).
- **`Municipal__c` (גם ב-Account וגם ב-Case) — ערכי הפיקליסט האמיתיים**: `משמ, 634, 1200, 6600, 229, 8400, 4000, 9100, 2034, 4203, 12345, 6100, 494, 195`. `src/validation.js` עכשיו מאמת מול הרשימה הזו.
- **`Case.Type` = `Info case` / `service case`** — מאושר, בדיוק כפי שניחשנו.
- **Person Account Record Type ("חשבון אישי") — `012Wn0000004InxIAE`.** גם הדיפולט של האובייקט, ולכן `Account.create` כנראה יעבוד גם בלעדיו, אבל הוגדר במפורש ב-`.env.example`.
- **`Case.OwnerId` הוא שדה חובה** (`reference -> Group, User`) לפי `describe()`. **עודכן:** הגורם הפונה/ה-API לא אמור לקבוע בעלות על הפניה — זה תפקיד האוטומציה/הניתוב הקיים בארגון (Flow שרץ לפני ה-insert יכול למלא שדה חובה עוד לפני שסיילספורס בודק את זה). לכן `Case.create()` כרגע **לא שולח `OwnerId` בכלל** אלא אם הוגדר `SF_CASE_DEFAULT_OWNER_ID` (אופציונלי, override בלבד) — האוטומציה של הארגון אמורה למלא את זה. אם בפועל יתברר שאין כזו אוטומציה ויצירת Case תיכשל עם `REQUIRED_FIELD_MISSING` על `OwnerId`, זה הסימן להגדיר את משתנה הסביבה.
- **`Case.Id_number__c` קיים** (type=Number) — שדה למספר ת"ז/דרכון ישירות על ה-Case. מוזן רק כש-`idType=IsraeliID` וה-idNumber מספרי (Number לא תומך בדרכון עם אותיות) — אם `IdentificationType` הוא Passport, השדה הזה נשאר ריק.
- **`ContactPointPhone` מחזיר `NOT_FOUND`.** האובייקט לא קיים/לא נגיש בארגון הזה, בניגוד למה שהמסמך המקורי תיאר. `src/routes/cases.js` עכשיו "בולע" את השגיאה הזו (log בלבד, לא נכשל) כדי לא לחסום את כל תהליך יצירת ה-Case — אבל **זו עדיין שאלה פתוחה**: איפה בפועל אמור להישמר מספר הטלפון של הפונה?

## פערים שנותרו פתוחים

1. **`Case.OwnerId`** — כרגע לא נשלח כלל מה-API; מניחים שהאוטומציה הקיימת בארגון תמלא אותו. **צריך אימות בפועל** (יצירת Case אמיתי) שזה נכון; אם לא — יש `SF_CASE_DEFAULT_OWNER_ID` כ-override (אפשר Id של `Moked_Queue`).
2. **`ContactPointPhone` NOT_FOUND** — צריך תשובה: האם להפעיל את האובייקט בארגון, או לאחסן את הטלפון בשדה אחר (יש כמה מועמדים על Account/Case כמו `Contact_Person_Phone__pc`, `WebMobile__c` — אבל אף אחד לא תואם בדיוק לתיאור במסמך המקורי).
3. **`CaseRoute__c`** — עדיין באחריות אוטומציה שתיבנה בתוך Salesforce (Flow), לא ה-API הזה. ה-API תומך בקבלת `caseRouteId` אם יסופק ישירות.
4. **Category/Topic/Sub-Topic תלויי-רשות** — כרגע אין ולידציה מול רשימה סגורה (כי היא משתנה לפי `municipality`); Salesforce עצמו ידחה ערך פיקליסט לא תקין ביצירת ה-Case (יחזור כ-`502 SF_ERROR` כללי, לא `400` ממוקד — פוטנציאל לשיפור עתידי).
5. **טיפול בשגיאות** (שדה חובה חסר / timeout מוניפורס) — המסמך המקורי מציין שאין הגדרה לכך. ההתנהגות הנוכחית: ולידציה מקדימה → `400`; כל כשל אחר → `502 SF_ERROR` עם `routeToHuman: true`.
6. **SLA (תגובה תוך שנייה)** — קשה להבטיח עם קריאות API סינכרוניות מרובות; העלאת קבצים מצורפים כבר זזה להיות אחרי התשובה כדי לצמצם את זה.

## משתני סביבה חדשים

ראו `.env.example` — נוספו `SF_PERSON_ACCOUNT_RECORD_TYPE_ID`, `SF_CONTACT_POINT_OWNER_ID`, `SF_CASE_FIELD_*`, ו-`AI_CLIENT_ID`/`AI_CLIENT_SECRET`/`JWT_SECRET` (להנפקת טוקן OAuth למערכת ה-AI).

## ה-Sandbox אותר — `SF_LOGIN_URL` עודכן

אושר שה-Sandbox האמיתי הוא:
`https://localgovernmenteconomicserviceslt2--mashamdev.sandbox.lightning.force.com` (Lightning UI).

עבור חיבור API/login (jsforce), יש להשתמש בכתובת ה-My Domain המקבילה — `https://<domain>--<sandbox>.sandbox.my.salesforce.com` במקום `.lightning.force.com` — כלומר:
`https://localgovernmenteconomicserviceslt2--mashamdev.sandbox.my.salesforce.com`

זהו כרגע ברירת המחדל ב-`.env.example`, **ומאושר עובד** — `npm run discover-sf-schema` התחבר בהצלחה עם הכתובת הזו.

### "Use Any API Auth" — פתרון סופי: הרשאת מערכת, לא Connected App

ניסיון login ראשון נגד ה-Sandbox האמיתי נכשל עם:
`INSUFFICIENT_ACCESS: SOAP API login() requires the Use Any API Auth user permission.`

נוסה תחילה מעבר ל-OAuth2 username-password flow דרך External Client App (הגרסה החדשה ל-Connected App) — **זה התברר כמבוי סתום**: היסטוריית הכניסות של המשתמש הראתה `"זרימת שם משתמש-סיסמה מושבתת"` — ה-org חוסם את זרימת ה-OAuth2 username-password הזו לגמרי, ברמת הארגון, ללא קשר להגדרות ה-App הספציפי.

**הפתרון בפועל: תת ההרשאה החסרה, "Use Any API Client" (בעברית: "השתמש באימות API כלשהו"), ניתנה כ-System Permission דרך Permission Set חדש שהוקצה למשתמש** — ואז ה-SOAP `login()` הקלאסי (username+password+token, בלי Connected App בכלל) עבד. `SF_CLIENT_ID`/`SF_CLIENT_SECRET` צריכים **להישאר ריקים** ב-`.env` — `src/salesforceClient.js` נופל אוטומטית לזרימת ה-SOAP הישנה כשהם ריקים, וזו הדרך הנכונה כרגע בארגון הזה.

### כלי לגילוי הסכימה בפועל — `npm run discover-sf-schema`

כדי לצמצם את הצורך בבדיקה ידנית ב-Object Manager, נוסף `scripts/discoverSalesforceSchema.js`: מתחבר לסיילספורס עם ה-credentials מ-`.env` ומדפיס בשורה אחת של פקודה את כל מה שהיה עד עכשיו "צריך לשאול את מנהל ה-ORG" — Record Types של Account (כולל ה-Id של Person Account), כל השדות ה-custom על Account/Case/ContactPointPhone (כולל type, שדה שאליו מצביע כל Lookup, וערכי הפיקליסטים בפועל).

הרצה:
```bash
cp .env.example .env   # למלא SF_LOGIN_URL/SF_USERNAME/SF_PASSWORD/SF_SECURITY_TOKEN
npm run discover-sf-schema
```

**מגבלה חשובה:** לא ניתן להריץ את זה מתוך סביבת הפיתוח הנוכחית (Claude Code על הענן) כי הרשת שלה חוסמת גישה ל-salesforce.com (ראו למטה). **הורץ בהצלחה** ממחשב עם גישת רשת רגילה (`C:\Users\yair\SF_Form`) ב-2026-09-06, והפלט המלא של Account/Case מתועד בסעיף "הסכימה אושרה" למעלה.

### בדיקות אוטומטיות — `npm test`

נוסף `test/unit.test.js` (Node's built-in test runner, ללא תלות חדשה) שמכסה את כל הלוגיקה שלא תלויה בחיבור חי לסיילספורס: ולידציית ה-payload (`validateCasePayload`) ובניית Subject/Description (`buildSubject`/`buildDescription`, כולל הקיצוץ ל-255/1000/32000 תווים). 6/6 עוברים. זה לא מחליף בדיקת אינטגרציה אמיתית מול Sandbox — זה רק מוודא שהלוגיקה הפנימית (שכן ניתן לבדוק בלי רשת) נכונה.

### חיבור לרשת מתוך סביבת הפיתוח הזו

ניסיתי לבדוק connectivity ל-domain הזה (`curl` פשוט, ללא credentials) מתוך סביבת ה-sandbox של הסשן הזה, וקיבלתי `403` מה-proxy היוצא (`gateway answered 403 to CONNECT — policy denial`). כלומר **הרשת של סביבת הפיתוח הזו חוסמת גישה ל-domains של salesforce.com**, ולכן אי אפשר לבדוק את החיבור בפועל מתוך הסשן הנוכחי — לא משנה אם ה-credentials נכונים או לא. בדיקת אינטגרציה אמיתית תצטרך לקרות מתוך סביבה שיש לה גישת רשת ל-Salesforce (למשל אחרי פריסה ל-Railway, או מ-laptop/סביבת CI עם גישה חיצונית רגילה).

## `GET /api/residents/:idNumber?idType=IsraeliID|Passport`

Endpoint נפרד לבדיקת תושב לפי ת"ז/דרכון, בלי לפתוח פניה — תואם לסעיף "העברת מידע מזהה (ת״ז)" במסמך: "הבינה המלאכותית תפנה עם ת"ז למערכת סיילספורס באמצעות API, שתחזיר פרטים על התושב". מאפשר ל-AI לפנות לתושב בשמו ולהזהיר על פניה פתוחה קיימת **באמצע השיחה**, לפני שהוחלט אם ואיך לפתוח פניה חדשה — בנוסף לבדיקת הכפילות המובנית בתוך `POST /api/cases` עצמו.

תשובה (נמצא): `{ "success": true, "found": true, "resident": { "firstName", "lastName", "callerType", "municipality" }, "openCase": { "caseNumber", "subject" } | null }`
תשובה (לא נמצא): `{ "success": true, "found": false }`
