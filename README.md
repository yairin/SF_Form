# SF Anonymous Form — טופס אנונימי לSalesforce Sandbox

טופס אינטרקטיבי דו-שלבי לשליחת פניות אנונימיות. הנתונים נשמרים כרשומת **`Form_Response__c`**
בSalesforce (דרך jsforce), בהתאם למודל הנתונים של המערכת. טריגר ה-Apex בצד Salesforce
מפרק את התשובות לרשומות `Form_Answer__c` לצורך דיווח.

> **דרישה מקדימה:** יש לפרוס תחילה את המטא-דאטה שב-`force-app/` (ראו `docs/DEPLOY.md`).
> אפליקציית ה-Node היא מסלול-ביניים; היעד ארוך-הטווח הוא טפסים נייטיביים
> (OmniStudio + Experience Cloud) — ראו `docs/FORM_BUILDER_SPEC.md`.

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
| `POST` | `/api/submit` | שליחת הטופס → יוצר רשומת `Form_Response__c` בSalesforce; מחזיר מספר סימוכין (FR-…) |
| `GET`  | `/api/health` | בדיקת חיבור לSalesforce (jsforce identity) |

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
- **מיפוי שדות**: שם/אימייל/טלפון/נושא נשמרים בשדות-המפתח של `Form_Response__c`; כל
  התשובות נשמרות גם כ-JSON ב-`Response_Data__c` (ומפורקות ל-`Form_Answer__c` בצד SF)
- **אימות**: `GET /api/health` מאמת את חיבור ה-jsforce לארגון
