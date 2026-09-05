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
| `POST` | `/api/submit` | שליחת הטופס → יוצר Lead בSalesforce (Web-to-Lead) |
| `GET`  | `/api/health` | בדיקת חיבור לSalesforce |
| `POST` | `/oauth/token` | הנפקת Bearer token (client_credentials) עבור מערכת ה-AI הטלפונית |
| `POST` | `/api/cases` | פתיחת פניה (Case) בסיילספורס דרך ה-API האמיתי (jsforce) — ראו `API_IMPLEMENTATION_NOTES.md` |
| `GET`  | `/api/residents/:idNumber` | בדיקת תושב לפי ת"ז/דרכון (לפני פתיחת פניה), כולל פניה פתוחה קיימת |

מדריך אינטגרציה מלא לגורם חיצוני (אימות, endpoints, דוגמאות, ערכי פיקליסט): `EXTERNAL_INTEGRATION_GUIDE.md`.

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
