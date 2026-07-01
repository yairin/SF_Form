# פריסה (Deploy) — מודל הנתונים והאוטומציה של SF Forms

מסמך זה מסביר כיצד לפרוס את מטא-הדאטה שנמצאת ב-`force-app/` לארגון Salesforce.
הפיתוח בוצע כ-**Salesforce DX metadata source** ונבנה לפי סקילי `forcedotcom/sf-skills`.

> **הערה:** בסביבת הפיתוח הנוכחית אין Salesforce CLI וארגון מחובר, ולכן הפריסה
> מתבצעת מול ארגון (Sandbox/Scratch) לאחר התקנת ה-CLI והתחברות.

## מה נכלל
| רכיב | נתיב |
|------|------|
| אובייקט `Form_Response__c` + שדות | `force-app/main/default/objects/Form_Response__c/` |
| אובייקט-בן `Form_Answer__c` + שדות (Master-Detail) | `force-app/main/default/objects/Form_Answer__c/` |
| טריגר + שירות Apex לפירוק ה-JSON | `force-app/main/default/triggers/`, `classes/FormResponseAnswerService.cls` |
| מחלקת בדיקות (Apex Test) | `classes/FormResponseAnswerServiceTest.cls` |
| Permission Sets (מנהל + Guest ציבורי) | `force-app/main/default/permissionsets/` |
| Custom Report Type בסיסי | `force-app/main/default/reportTypes/Form_Responses.reportType-meta.xml` |

## שלבי פריסה
```bash
# 1. התקנת Salesforce CLI (פעם אחת)
npm install --global @salesforce/cli

# 2. התחברות לארגון (Sandbox = test.salesforce.com)
sf org login web --alias sfforms --instance-url https://test.salesforce.com

# 3. פריסת המטא-דאטה
sf project deploy start --source-dir force-app --target-org sfforms

# 4. הרצת בדיקות ה-Apex
sf apex run test --target-org sfforms --code-coverage --result-format human

# 5. הקצאת ההרשאות
sf org assign permset --name SF_Forms_Manager --target-org sfforms
```

## אימות (Verification)
1. **הפריסה עברה** ללא שגיאות (`Deploy Succeeded`).
2. **בדיקות Apex ירוקות** (3 מתודות ב-`FormResponseAnswerServiceTest`, כיסוי > 90%).
3. יצירת רשומת `Form_Response__c` ידנית עם `Response_Data__c` שהוא JSON תקין
   (למשל `{"track":"בוקר","party_size":3}`) יוצרת אוטומטית רשומות `Form_Answer__c`
   מתאימות — אימות שהטריגר עובד.
4. דוח מסוג **Form Responses** מציג את הרשומות.

## שלבים הבאים (נבנים מול ארגון חי עם הסקילים)
- **Custom Report Type "Form Responses with Answers"** (Response + Answers) —
  `platform-metadata-deploy` / עורך ה-Report Type.
- **OmniScript** לטופס עצמו — `omnistudio-omniscript-generate`.
- **אתר Experience Cloud** לפרסום ציבורי — `experience-ui-bundle-site-generate`.
- **Document Generation** (PDF/Word) — `omnistudio-integration-procedure-generate`.
- **דשבורדים** — `platform-metadata-deploy`.

> תזכורת (ראו `CLAUDE.md`): לפני כל פיתוח SF — שימוש בסקילים, ניצול מלא של רישוי PSS,
> וגישת Native-first.
