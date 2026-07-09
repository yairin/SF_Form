# בית אחד 🏠 — מערכת ניהול משפחתית

אפליקציית ווב (RTL, עברית) לניהול חיי הבית המשותפים: **מטלות בית, דמי כיס, רשימת קניות וסקרים/החלטות**.
נגישה מכל מכשיר, עם הזדהות פשוטה של שם + קוד PIN והבחנה בין **הורה** (מנהל) ל**ילד/ה**.

> הפרויקט אינו קשור יותר ל-Salesforce — הוא אפליקציה עצמאית שמאחסנת את הנתונים בענן (Postgres) או בקובץ מקומי.

## היכולות

| מודול | הורה | ילד/ה |
|---|---|---|
| **מטלות בית** | יוצר/מקצה מטלה, מאשר או מחזיר ביצוע | רואה את המטלות שלו, מסמן "סיימתי" |
| **דמי כיס** | מוסיף זיכוי/חיוב, רואה יתרות של כולם | רואה את היתרה שלו (ושל אחים אם הוגדר) |
| **רשימת קניות** | מוסיף ישירות, מאשר/דוחה בקשות | מבקש מוצר → ממתין לאישור הורה |
| **סקרים והחלטות** | יוצר/מצביע/סוגר | יוצר/מצביע בסקרים משפחתיים |

- **קישור מטלות ← דמי כיס**: אישור מטלה עם שווי (₪) זוקף אוטומטית זיכוי דמי כיס לילד שביצע.
- **אלוף/ת הבית**: סיכום שבועי עם דירוג לפי מטלות שהושלמו ונקודות שנצברו.
- **הרשאות צפייה**: דמי הכיס של כל ילד פרטיים כברירת מחדל; ההורה יכול לחשוף אותם לאחים.

## Tech Stack

- **Backend**: Node.js + Express, JWT + PIN (bcrypt)
- **Frontend**: HTML / CSS / Vanilla JS (RTL, עברית), ללא שלב build
- **אחסון**: שכבת נתונים מופשטת —
  - **Postgres** בענן כשמוגדר `DATABASE_URL` (טבלת `collections` נוצרת אוטומטית),
  - אחרת **קובץ JSON מקומי** (`data/db.json`) — נוח לפיתוח והרצה מהירה.

## התקנה והרצה מקומית

```bash
npm install
cp .env.example .env      # ערוך את JWT_SECRET (וב-DATABASE_URL אם רוצים Postgres)
npm start                 # או: npm run dev (עם hot reload)
```

האפליקציה תעלה בכתובת **http://localhost:3000**. בכניסה הראשונה תתבקש להקים את הבית (יצירת הורה מנהל).

### בדיקות

```bash
npm start                 # בטרמינל אחד
npm run test:api          # בטרמינל שני — בדיקת עשן מקצה לקצה של ה-API
```

## פריסה לענן (מומלץ: Railway)

Railway מספק גם שרת Node וגם Postgres מנוהל, עם פריסה אוטומטית מ-git:

1. פתח חשבון ב-[railway.app](https://railway.app) וחבר את מאגר ה-git.
2. הוסף **PostgreSQL** לפרויקט (Railway יגדיר `DATABASE_URL` אוטומטית).
3. הגדר משתני סביבה:
   - `JWT_SECRET` — מחרוזת אקראית ארוכה (חובה).
   - `PGSSL=true` (ברירת מחדל מתאימה לרוב הספקים).
   - `SETUP_CODE` — אופציונלי, קוד שנדרש כדי להקים את הבית (הורה ראשון).
4. Railway יריץ `npm start` וייתן כתובת ציבורית נגישה מכל מקום.

> אותה תצורה עובדת גם ב-**Render** / **Fly.io** / **Supabase (Postgres)** — כל מה שצריך הוא להזין `DATABASE_URL` ו-`JWT_SECRET`.

## מבנה הפרויקט

```
SF_Form/
├── server.js                 # נקודת כניסה + חיבור הנתיבים
├── src/
│   ├── store.js              # שכבת נתונים ברמה גבוהה
│   ├── auth.js               # PIN + JWT + הרשאות
│   ├── backends/
│   │   ├── json.js           # אחסון קובץ מקומי
│   │   └── pg.js             # אחסון Postgres (ענן)
│   └── routes/               # auth, tasks, allowance, shopping, surveys, summary
├── public/                   # ממשק המשתמש (index.html, styles.css, app.js)
├── scripts/smoke.js          # בדיקת עשן ל-API
└── .env.example
```

## API עיקרי

| Method | Path | תיאור |
|--------|------|-------|
| `GET`  | `/api/auth/status` | האם הבית אותחל |
| `POST` | `/api/auth/setup` | יצירת הורה מנהל ראשון |
| `POST` | `/api/auth/login` | התחברות (שם/מזהה + PIN) |
| `GET/POST/PATCH/DELETE` | `/api/auth/members` | ניהול בני משפחה (הורה) |
| `GET/POST` + `/:id/submit\|approve\|reject` | `/api/tasks` | מטלות |
| `GET/POST` + `/:memberId` + `/txn/:id` | `/api/allowance` | דמי כיס |
| `GET/POST` + `/:id/approve\|reject\|purchased` | `/api/shopping` | קניות |
| `GET/POST` + `/:id/vote\|close` | `/api/surveys` | סקרים |
| `GET`  | `/api/summary/weekly` | סיכום שבועי + אלוף הבית |

## הרחבות עתידיות

- התראות וסיכום שבועי ל-WhatsApp/Telegram (המבנה מוכן — סיכום זמין ב-`/api/summary/weekly`).
- מטלות מחזוריות אוטומטיות.
