# מדריך מעשי: יצירת טופס, מילוי, ובחינת התוצאות

מדריך זה מנחה אותך מקצה-לקצה עם מה שכבר מוכן במערכת: פריסת מודל הנתונים ל-Salesforce,
הפעלת הטופס, מילויו, ובחינת התוצאות ב-Salesforce (רשומת `Form_Response__c` + רשומות
`Form_Answer__c` שנוצרות אוטומטית + דוח).

> **מה זמין כרגע:** הטופס "טופס פתיחת פנייה" (אפליקציית Node) שכותב ל-`Form_Response__c`.
> מחולל הטפסים הוויזואלי הנייטיבי (OmniScript/Experience Cloud) הוא שלב הבא — ראו
> `docs/FORM_BUILDER_SPEC.md`.

---

## דרישות מקדימות
- ארגון Salesforce (מומלץ **Sandbox**) עם הרשאות אדמין.
- **Salesforce CLI**: `npm install --global @salesforce/cli`
- **Node.js 18+**.
- Security Token של המשתמש (Setup → My Personal Information → Reset My Security Token).

---

## שלב 1 — פריסת המערכת ל-Salesforce
פורס את האובייקטים, הטריגר, ה-Apex, ה-Permission Sets ו-Report Type.

```bash
# התחברות לארגון (Sandbox = test.salesforce.com)
sf org login web --alias sfforms --instance-url https://test.salesforce.com

# פריסת המטא-דאטה
sf project deploy start --source-dir force-app --target-org sfforms

# הרצת בדיקות ה-Apex (אופציונלי, מומלץ)
sf apex run test --target-org sfforms --code-coverage --result-format human

# הקצאת הרשאות מנהל למשתמש שלך
sf org assign permset --name SF_Forms_Manager --target-org sfforms
```
✅ בסיום: קיימים בארגון `Form_Response__c`, `Form_Answer__c`, הטריגר `FormResponseTrigger`,
ו-Report Type בשם **Form Responses**.

---

## שלב 2 — "יצירת" / הפעלת הטופס
```bash
# מהשורש של הפרויקט
cp .env.example .env      # אם עדיין אין .env
```
ערוך את `.env`:
```
SF_LOGIN_URL=https://test.salesforce.com
SF_USERNAME=your_user@example.com.sandbox
SF_PASSWORD=YourPassword
SF_SECURITY_TOKEN=YourSecurityToken
PORT=3000
```
הרץ:
```bash
npm install
npm start
```
פתח את **http://localhost:3000** — זהו הטופס.

**רוצה להתאים את שדות הטופס?** (עד שהבונה הוויזואלי מוכן)
- שדות/כותרות ומראה: `public/index.html` + `public/styles.css`.
- ולידציות בצד לקוח: `public/app.js` (`validators`).
- ולידציה ומיפוי לשדות SF: `server.js` (`validateFormData`, `buildAnswers`, `buildRecord`).

בדיקת חיבור מהירה:
```bash
curl http://localhost:3000/api/health
# → {"status":"ok","mode":"jsforce","object":"Form_Response__c", ...}
```

---

## שלב 3 — מילוי הטופס
1. בדף הטופס מלא: שם פרטי, שם משפחה, אימייל (חובה); טלפון/ארגון (אופציונלי).
2. המשך → נושא הפנייה, תוכן, ורמת דחיפות.
3. סיכום → **שלח פנייה**.
4. תקבל מסך אישור עם **מספר סימוכין** בפורמט `FR-00001`.

דוגמה למילוי:
| שדה | ערך |
|-----|-----|
| שם | ישראל ישראלי |
| אימייל | israel@example.com |
| טלפון | 050-1234567 |
| נושא | בקשת מידע |
| תוכן | אני מעוניין לקבל פרטים על האירוע |
| דחיפות | בינוני |

---

## שלב 4 — בחינת התוצאות ב-Salesforce

### א. רשומת `Form_Response__c`
פתח בדפדפן (בתוך הארגון):
`/lightning/o/Form_Response__c/list`
תמצא רשומה חדשה (למשל `FR-00001`) עם השדות הממופים:
- **Respondent Name** = ישראל ישראלי
- **Email** = israel@example.com
- **Phone** = 050-1234567
- **Subject** = בקשת מידע
- **Status** = New
- **Response Data (JSON)** = כל התשובות:
```json
{"firstName":"ישראל","lastName":"ישראלי","email":"israel@example.com",
 "phone":"050-1234567","company":"","subject":"בקשת מידע",
 "message":"אני מעוניין לקבל פרטים על האירוע","urgency":"בינוני"}
```

### ב. רשומות `Form_Answer__c` (נוצרו אוטומטית ע"י הטריגר)
ברשומת ה-`Form_Response__c`, ברשימה הקשורה **Answers** — שורה לכל תשובה:
| Field Key | Value (Text) |
|-----------|--------------|
| firstName | ישראל |
| lastName | ישראלי |
| email | israel@example.com |
| phone | 050-1234567 |
| subject | בקשת מידע |
| message | אני מעוניין לקבל פרטים על האירוע |
| urgency | בינוני |

> זה בדיוק המנגנון שהופך כל שדה ל**ניתן-לדיווח** — ראו `docs/REPORT_GENERATOR_SPEC.md`.

### ג. דוח
1. **Reports → New Report**.
2. בחר את סוג הדוח **Form Responses** (או "Form Responses with Answers" לפילוח לפי שדה).
3. הוסף קיבוץ (למשל לפי **Status** או **Form Name**), שמור והרץ.
4. לדשבורד: **Dashboards → New Dashboard** והוסף רכיב מהדוח.

---

## בונה טפסים דינמי — יצירת טופס עם שדות משלך

בנוסף לטופס הקבוע, קיים **בונה טפסים** שמאפשר להגדיר שדות תוך כדי יצירה, לפרסם קישור
ציבורי אנונימי, ולקבל את התשובות ל-`Form_Response__c` (בדיוק כמו כל טופס אחר).

1. הפעל את האפליקציה (`npm start`) עם `.env` שמחובר לארגון.
2. פתח **http://localhost:3000/builder**.
3. הגדר **כותרת**, ולחץ **"+ הוסף שדה"** לכל שדה: בחר **סוג** (טקסט/אימייל/טלפון/מספר/
   תאריך/בחירה מרשימה/בחירה יחידה/תיבת סימון/בחירה מרובה), הזן **תווית**, סמן **חובה**,
   ולסוגי בחירה — הזן **אפשרויות** (שורה לכל אחת). אופציונלי: **מיפוי** שדה לשדה-מפתח
   ב-Salesforce (שם/אימייל/טלפון/נושא).
4. **"שמור ופרסם"** → מתקבל **קישור ציבורי** בפורמט `/f/<slug>`.
5. שתף את הקישור (אנונימי, ללא התחברות). כל שליחה יוצרת `Form_Response__c`, והטריגר
   מפרק אותה ל-`Form_Answer__c` — נהל ב-Salesforce כרגיל.

> **פרסום לאינטרנט:** להרצה ציבורית אמיתית פרוס את אפליקציית ה-Node (למשל Railway).
> מקומית הקישור הוא `localhost`. הגדרות הטפסים נשמרות תחת `data/forms/` (מקומי).
> **הערה ארכיטקטונית:** זהו מסלול פרקטי לבדיקה מלאה עכשיו; היעד ארוך-הטווח הוא בונה
> נייטיבי ב-OmniStudio + Experience Cloud (`docs/FORM_BUILDER_SPEC.md`).

## פתרון תקלות
| תסמין | סיבה / פתרון |
|-------|---------------|
| `/api/health` מחזיר error | בדוק `.env` (username/password/token); ב-Sandbox השם כולל `.sandboxname` |
| `INVALID_LOGIN` | סיסמה/טוקן שגויים, או IP חסום — אפס Security Token |
| השליחה נכשלת (500) | ודא שפרסת את `force-app` ושיש הרשאת create ל-`Form_Response__c` |
| לא נוצרות רשומות `Form_Answer__c` | ודא שהטריגר `FormResponseTrigger` פעיל וש-`Response_Data__c` הוא JSON תקין |
| הרשומות לא נראות | הקצה `SF_Forms_Manager`, או גש ישירות ל-`/lightning/o/Form_Response__c/list` |

---

## מה הלאה
- **בונה טפסים ויזואלי** נייטיבי (OmniScript) + פרסום ב-Experience Cloud.
- **מחולל דוחות** מלא (דשבורדים, מסמכי PDF) — `docs/REPORT_GENERATOR_SPEC.md`.
