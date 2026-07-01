# SF Anonymous Form — טופס אנונימי לSalesforce Sandbox

טופס אינטרקטיבי דו-שלבי לשליחת פניות אנונימיות. הנתונים נשמרים כ-Lead בSalesforce Sandbox.

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: HTML / CSS / Vanilla JS (RTL, עברית)
- **Salesforce SDK**: jsforce
- **Rate limiting**: express-rate-limit

## התקנה

```bash
npm install
```

## הגדרת Salesforce Sandbox

### 1. צור Connected App בSalesforce Sandbox
- **Setup → App Manager → New Connected App**
- Enable OAuth Settings
- Callback URL: `http://localhost:3000/callback`
- Selected OAuth Scopes: `api`, `refresh_token`
- שמור ורשום את ה-Consumer Key/Secret

### 2. הגדרת Security Token
- **Setup → My Personal Information → Reset My Security Token**
- הtoken יישלח לאימייל שלך

### 3. קובץ `.env`

```bash
cp .env.example .env
```

ערוך את `.env`:

```
SF_LOGIN_URL=https://test.salesforce.com
SF_USERNAME=your_username@example.com.sandbox
SF_PASSWORD=YourPassword123
SF_SECURITY_TOKEN=YourTokenHere
PORT=3000
```

> **שים לב**: ב-Salesforce Sandbox השם המלא הוא `username@email.com.sandboxname`

## הרצה

```bash
# Development (עם hot reload)
npm run dev

# Production
npm start
```

הטופס יהיה זמין בכתובת: **http://localhost:3000**

## מבנה הפרויקט

```
SF_Form/
├── server.js          # Express server + Salesforce API
├── package.json
├── .env               # (לא ב-git!) credentials
├── .env.example       # דוגמה לקובץ .env
└── public/
    ├── index.html     # ממשק הטופס (RTL, עברית)
    ├── styles.css     # עיצוב
    └── app.js         # לוגיקת הטופס
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/submit` | שליחת הטופס האנונימי → יוצר Lead בSalesforce (Web-to-Lead) |
| `GET`  | `/api/health` | בדיקת מצב Web-to-Lead |
| `POST` | `/api/emergency` | הקמת אירוע חירום → יוצר רשומה במאגר החירום (jsforce) |
| `GET`  | `/api/emergency/health` | בדיקת חיבור jsforce למאגר החירום |

## טופס הקמת אירוע חירום — `/emergency`

טופס ייעודי בכתובת **http://localhost:3000/emergency.html** לפתיחת אירוע במאגר החירום.
בניגוד לטופס האנונימי (Web-to-Lead), אירוע נשמר באובייקט מותאם אישית ולכן נדרש
חיבור **jsforce מאומת** — הגדר את פרטי ההתחברות ומיפוי השדות ב-`.env`.

> ⚠️ **מיפוי שדות**: ערכי ברירת המחדל ב-`.env.example` (למשל `Emergency_Event__c`,
> `Event_Type__c`) הם **placeholders**. משוך את המטא-דאטה של המודול
> (`scripts/sf-retrieve.sh CustomApplication`) כדי לגלות את ה-API Names האמיתיים
> של האובייקט והשדות, ועדכן את משתני `SF_EMERGENCY_*` / `SF_F_*` בהתאם.
> אם `type` / `severity` / `status` הם picklist ב-Salesforce, ודא שהערכים
> בעברית תואמים לערכי ה-API של ה-picklist.

### לוגו מרכז השלטון המקומי

בראש טופס החירום מוצג לוגו הארגון. שמור את קובץ הלוגו בשם **`public/logo-local-gov.png`**
(אפשר גם לייצא אותו מ-Salesforce כ-Static Resource / Document). אם הקובץ חסר,
הבאנר פשוט לא יוצג (fallback חלק) והטופס ימשיך לתפקד כרגיל.

לפיתוח על מודול "מאגר חירום" עצמו (אובייקטים, Flows, Apex, LWC) — ראה `SALESFORCE.md`.

### דוגמה לשליחה ידנית

```bash
curl -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "ישראל",
    "lastName": "ישראלי",
    "email": "israel@example.com",
    "subject": "בקשת מידע",
    "message": "אני מעוניין לקבל פרטים נוספים על השירות.",
    "rating": "Warm"
  }'
```

## הערות חשובות

- **Rate limiting**: מוגבל ל-10 בקשות לכל IP בכל 15 דקות
- **אנונימיות**: הטופס לא דורש הזדהות. שדות phone ו-company אופציונליים
- **Custom field**: אם רוצים לשמור את ה-subject בשדה נפרד בSalesforce, צור שדה `Subject__c` ב-Lead Object, אחרת הוא נכלל ב-Description
