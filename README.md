# בית אחד 🏠 — מערכת ניהול משפחתית

אפליקציית ווב (RTL, עברית) לניהול חיי הבית המשותפים: **מטלות בית, דמי כיס, רשימת קניות וסקרים/החלטות**.
נגישה מכל מכשיר, עם הזדהות פשוטה של שם + קוד PIN והבחנה בין **הורה** (מנהל) ל**ילד/ה**.
הנתונים נשמרים ב-**Firebase (Firestore)** בענן, והתראות נשלחות ב-**WhatsApp**.

## היכולות

| מודול | הורה | ילד/ה |
|---|---|---|
| **מטלות בית** | יוצר/מקצה מטלה, מאשר או מחזיר ביצוע | רואה את המטלות שלו, מסמן "סיימתי" |
| **דמי כיס** | מוסיף זיכוי/חיוב, רואה יתרות של כולם | רואה את היתרה שלו (ושל אחים אם הוגדר) |
| **רשימת קניות** | מוסיף ישירות, מאשר/דוחה בקשות | מבקש מוצר → ממתין לאישור הורה |
| **סקרים והחלטות** | יוצר/מצביע/סוגר | יוצר/מצביע בסקרים משפחתיים |

### מטלות: חובה מול בתשלום
כל מטלה מוגדרת כ-**"חובה"** (ללא תשלום — ברירת המחדל) או **"בתשלום"** עם סכום קבוע.
רק אישור מטלת **"בתשלום"** זוקף זיכוי אוטומטי לדמי הכיס; מטלות חובה נספרות לטבלת "אלוף הבית"
השבועית אך אינן משפיעות על היתרה.

### ספריית מטלות קבועה + הקצאה מהירה
כל מטלה שנוצרת יכולה להתווסף (תיבת סימון) ל**ספריית מטלות קבועה** משותפת למשפחה.
בכפתור **"📋 הקצאה מהירה מרשימת מטלות"** ההורה בוחר ילד/ה ומסמן כמה מטלות מהספרייה בבת אחת —
כל אחת נוצרת כמטלה פתוחה בהתאם לסוג ולסכום שהוגדרו בתבנית. אפשר גם להוסיף/למחוק מהספרייה
ישירות מתוך אותו מסך.

### דמי כיס חודשיים קבועים (לוח עברי)
לכל ילד אפשר להגדיר **סכום חודשי קבוע** (במסך "משפחה"). הסכום נזקף אוטומטית בכל
**ראש חודש עברי** — נבדק בכל עליית שרת ואז כל כמה שעות, כך שאין תלות בשירות תזמון חיצוני;
סימון פנימי (`lastStipendMonth`) מבטיח שהזיכוי מתבצע פעם אחת בלבד לכל חודש עברי.

- **קישור מטלה בתשלום ← דמי כיס**: אישור מטלה בתשלום זוקף אוטומטית זיכוי דמי כיס לילד שביצע.
- **אלוף/ת הבית**: סיכום שבועי עם דירוג לפי מטלות שהושלמו ונקודות שנצברו.
- **הרשאות צפייה**: דמי הכיס של כל ילד פרטיים כברירת מחדל; ההורה יכול לחשוף אותם לאחים.
- **התראות WhatsApp**: הקצאת מטלה/מטלות (לילד), סיום מטלה (להורים), אישור מטלה (לילד), ובקשת קנייה (להורים).

## Tech Stack

- **Backend**: Node.js + Express, JWT + PIN (bcrypt)
- **Frontend**: HTML / CSS / Vanilla JS (RTL, עברית), ללא שלב build
- **אחסון**: שכבת נתונים מופשטת עם בחירת backend לפי הסביבה —
  - **Firestore (Firebase)** — כשמוגדר `FIREBASE_PROJECT_ID` / `USE_FIRESTORE=true` (מומלץ, בענן),
  - **Postgres** — כשמוגדר `DATABASE_URL` (חלופה),
  - אחרת **קובץ JSON מקומי** (`data/db.json`) — נוח לפיתוח והרצה מהירה.
- **התראות**: WhatsApp Cloud API (Meta). ללא הגדרה — מצב dry-run שרושם ל-console.

## התקנה והרצה מקומית

```bash
npm install
cp .env.example .env      # ערוך את JWT_SECRET (השאר Firestore/WhatsApp ריקים כדי לרוץ מקומית)
npm start                 # או: npm run dev
```

ללא הגדרות ענן, האפליקציה עולה ב-**http://localhost:3000**, שומרת ל-`data/db.json`,
וההתראות נרשמות ל-console. בכניסה הראשונה תוקם הבית (יצירת הורה מנהל).

### בדיקות

```bash
npm start                 # בטרמינל אחד
npm run test:api          # בטרמינל שני — בדיקת עשן מקצה לקצה של ה-API
```

## פריסה ל-Firebase

הארכיטקטורה: **Firebase Hosting** מגיש את הפרונט (CDN), הבקשות ל-`/api/**` מנותבות
לשרת ה-Express שרץ ב-**Cloud Run**, והנתונים נשמרים ב-**Firestore**.

### הכנה חד-פעמית
```bash
npm install -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc     # החלף ב-Project ID שלך
```
בקונסולת Firebase: צור פרויקט, הפעל **Firestore** (מצב production), ושדרג לתוכנית **Blaze**
(נדרש ל-Cloud Run ולקריאות רשת יוצאות ל-WhatsApp).

### 1) פריסת שרת ה-API ל-Cloud Run
```bash
gcloud run deploy bait-echad \
  --source . \
  --region me-west1 \
  --allow-unauthenticated \
  --set-env-vars JWT_SECRET=<סוד-אקראי-ארוך>,FIREBASE_PROJECT_ID=<PROJECT_ID>,WHATSAPP_TOKEN=<טוקן>,WHATSAPP_PHONE_ID=<phone-id>
```
> `serviceId` ו-`region` ב-`firebase.json` חייבים להתאים לשם ולאזור כאן (ברירת מחדל: `bait-echad` / `me-west1`).
> ב-Cloud Run הרשאות Firestore נטענות אוטומטית — אין צורך בקובץ מפתח.

### 2) פריסת הפרונט וכללי Firestore
```bash
firebase deploy --only hosting,firestore:rules
```
כתובת ה-Hosting נגישה מכל מקום. הכללים (`firestore.rules`) נועלים גישה ישירה של הלקוח —
כל הגישה עוברת דרך ה-API (Admin SDK), כך שהנתונים מוגנים.

## הגדרת התראות WhatsApp

1. ב-[Meta for Developers](https://developers.facebook.com/) צור אפליקציה מסוג **Business**
   והוסף את מוצר **WhatsApp**.
2. קבל **Phone Number ID** ו-**access token** → הגדר `WHATSAPP_PHONE_ID` ו-`WHATSAPP_TOKEN`.
3. הזן מספר טלפון לכל בן משפחה (במסך "משפחה"). מספר מקומי (05...) מומר אוטומטית לפורמט בינלאומי (972...).

> שליחת טקסט חופשי מותרת בחלון 24 השעות מאז הודעת המשתמש האחרונה; ליזום מחוץ לחלון נדרשת
> תבנית (template) מאושרת. ללא הגדרת המפתחות המערכת פועלת ב-dry-run (רישום ל-console).

## מבנה הפרויקט

```
SF_Form/
├── server.js                 # נקודת כניסה + חיבור הנתיבים
├── Dockerfile                # פריסת ה-API ל-Cloud Run
├── firebase.json             # Hosting + ניתוב /api ל-Cloud Run + כללי Firestore
├── firestore.rules           # נעילת גישה ישירה (הכול דרך ה-API)
├── .firebaserc.example       # תבנית Project ID
├── src/
│   ├── store.js              # שכבת נתונים ובחירת backend
│   ├── auth.js               # PIN + JWT + הרשאות
│   ├── notify.js             # התראות WhatsApp (Cloud API)
│   ├── hebrew.js             # עזרי לוח עברי (ראש חודש)
│   ├── stipend.js            # זיכוי דמי כיס חודשיים קבועים
│   ├── backends/
│   │   ├── firestore.js      # אחסון Firestore (Firebase)
│   │   ├── pg.js             # אחסון Postgres (חלופה)
│   │   └── json.js           # אחסון קובץ מקומי (פיתוח)
│   └── routes/               # auth, tasks, allowance, shopping, surveys, summary
├── public/                   # ממשק המשתמש (index.html, styles.css, app.js)
└── scripts/smoke.js          # בדיקת עשן ל-API
```

## API עיקרי

| Method | Path | תיאור |
|--------|------|-------|
| `GET`  | `/api/auth/status` | האם הבית אותחל |
| `POST` | `/api/auth/setup` | יצירת הורה מנהל ראשון |
| `POST` | `/api/auth/login` | התחברות (שם/מזהה + PIN) |
| `GET/POST/PATCH/DELETE` | `/api/auth/members` | ניהול בני משפחה (הורה) |
| `GET/POST` + `/:id/submit\|approve\|reject` | `/api/tasks` | מטלות (type: duty/paid) |
| `GET/POST/DELETE` | `/api/tasks/templates` | ספריית מטלות קבועה |
| `POST` | `/api/tasks/assign-from-templates` | הקצאה מהירה מהספרייה |
| `GET/POST` + `/:memberId` + `/txn/:id` | `/api/allowance` | דמי כיס |
| `GET/POST` + `/:id/approve\|reject\|purchased` | `/api/shopping` | קניות |
| `GET/POST` + `/:id/vote\|close` | `/api/surveys` | סקרים |
| `GET`  | `/api/summary/weekly` | סיכום שבועי + אלוף הבית |

## הרחבות עתידיות

- סיכום WhatsApp שבועי אוטומטי (הנתונים כבר זמינים ב-`/api/summary/weekly`).
- מטלות מחזוריות אוטומטיות.
