# אפיון מערכת: בניית, עיצוב ופרסום טפסים — "SF Forms"

> מסמך אפיון (Specification) — גרסה 2.0 (Native-first · PSS)
> סטטוס: טיוטה לאישור · תוצר של שלב 0 (אפיון)
> מבוסס על החלטות שנקבעו מול הלקוח (ראו "החלטות מפתח").

---

## 0. החלטות מפתח (Baseline)

| # | נושא | ההחלטה |
|---|------|--------|
| 1 | **מודל אחסון ב-Salesforce** | אובייקט Custom **גמיש אחד** — `Form_Response__c` — ששומר את כל התשובות (JSON) + שדות-מפתח ממופים. |
| 2 | **ניהול פונים ויצירת קשר** | בתוך **Salesforce** (Reports, List Views, Flows, Email). |
| 3 | **הזדהות בונה הטפסים** | דרך **Salesforce** (התחברות נייטיבית / OAuth). |
| 4 | **רישוי** | **PSS — Public Sector Solutions** (ענן המגזר הציבורי). יש לנצל את **מלוא** יכולות הרישוי והפלטפורמה. |
| 5 | **היקף שלב נוכחי** | **מסמך אפיון בלבד** — ללא כתיבת קוד. |

### עקרון-על מנחה (חובה לפני כל פיתוח SF)
מתועד גם ב-`CLAUDE.md`:
1. **Native-first** — להעדיף יכולות מובנות של Salesforce/PSS על פני פתרונות חיצוניים.
2. **שימוש בספריית הסקילים הרשמית** `forcedotcom/sf-skills` (מותקנת ב-`.agents/skills/`),
   ובסקיל הרלוונטי לכל משימה.
3. **ניצול מלא של רישוי PSS** — Licenses/Permits/Inspections, Case Management,
   Business Rules Engine, OmniStudio, Experience Cloud, Data Cloud, Agentforce.

---

## 1. תקציר מנהלים

היום קיים **טופס בודד מקודד-קשיח** ("טופס פתיחת פנייה"): שרת Node/Express שמגיש דף
HTML אחד, ושליחה ל-Salesforce דרך Web-to-Lead. כל טופס חדש דורש כתיבת קוד ופריסה.

**המערכת המוצעת** הופכת זאת לפלטפורמה **נייטיבית ב-Salesforce**: אדם לא-טכנולוגי
מעצב טופס אינטראקטיבי בכלים ויזואליים, מפרסם אותו בכתובת ציבורית (אתר Experience
Cloud), והתשובות נשמרות ומנוהלות ב-Salesforce.

**דוגמה מלאה — פרסום אירוע ורישום:** רכז בונה טופס רישום (שם, אימייל, טלפון, בחירת
מסלול, הצורך בהסעה → שדה כתובת מותנה), מפרסם קישור ציבורי, ומשתף. כל נרשם נשמר
כ-`Form_Response__c`; Flow יוצר Contact + רישום לאירוע ושולח מייל אישור; הרכז מנהל
את הנרשמים, מסנן ומפיק דוחות — הכל ב-Salesforce.

---

## 2. פרסונות ותרחישי שימוש

| פרסונה | תיאור | ערוץ |
|--------|-------|------|
| **בונה טפסים** | עובד לא-טכנולוגי. מעצב ומפרסם טפסים. | Salesforce (OmniScript Designer / Experience Builder) |
| **פונה / נרשם** | משתמש מהציבור, **אנונימי** (Guest User). | אתר Experience Cloud ציבורי |
| **מנהל** | עובד ה-CRM. מנהל תשובות, מסנן, יוצר קשר, מפיק דוחות. | Salesforce |

**תרחיש קצה-לקצה:** התחברות ל-SF → בניית טופס ב-OmniScript עם ולידציות ולוגיקה
מותנית → עיצוב (SLDS/Brand) → פרסום באתר Experience Cloud → מילוי ע"י הפונה →
ולידציה נייטיבית → שמירה ל-`Form_Response__c` → Flow ליצירת קשר → ניהול ב-SF.

---

## 3. ארכיטקטורה — Native-first (מומלצת)

כל המערכת חיה בתוך Salesforce PSS. אין מסד נתונים חיצוני ואין שרת חיצוני.

```
┌──────────────────────── Salesforce (PSS Org) ────────────────────────┐
│                                                                        │
│  בונה טפסים ─▶ OmniStudio OmniScript Designer  (בניית טופס ויזואלית)   │
│               + Experience Builder (עיצוב אתר/דף)                      │
│                                                                        │
│  פונה אנונימי ─▶ אתר Experience Cloud (Digital Experience Site,        │
│  (Guest User)     Guest access) ─▶ מריץ את ה-OmniScript                │
│                          │                                             │
│                          ▼ (DataMapper / Integration Procedure)        │
│                  ┌─────────────────────┐                              │
│                  │  Form_Response__c   │◀── Validation / Business      │
│                  │  (+ Files)          │     Rules Engine              │
│                  └──────────┬──────────┘                              │
│                             ▼ Record-Triggered Flow                    │
│                  Contact / Case / Campaign / Email  ─▶ מנהל (Reports)  │
└────────────────────────────────────────────────────────────────────────┘
```

**רכיבים ומיפוי לסקילים המותקנים (`.agents/skills/`):**

| רכיב | יכולת נייטיבית | סקיל |
|------|----------------|------|
| בניית טופס אינטראקטיבי, רב-שלבי, לוגיקה מותנית, ולידציות | **OmniStudio OmniScript** | `omnistudio-omniscript-generate` |
| ווידג'טים/כרטיסי תצוגה | **FlexCards** | `omnistudio-flexcard-generate` |
| קריאה/כתיבה ל-`Form_Response__c` | **DataMapper / Integration Procedure** | `omnistudio-datamapper-generate`, `omnistudio-integration-procedure-generate` |
| אתר ציבורי לפרסום | **Experience Cloud Site** (Guest) | `experience-ui-bundle-site-generate` |
| האובייקט והשדות | **Custom Object / Fields** | `platform-custom-object-generate`, `platform-custom-field-generate` |
| ולידציות ברמת רשומה | **Validation Rules / Business Rules Engine** | `platform-validation-rule-generate` |
| לוגיקת המשך (יצירת קשר) | **Record-Triggered Flow** | `automation-flow-generate` |
| הרשאות (כולל Guest) | **Permission Sets / Sharing** | `platform-permission-set-generate`, `platform-sharing-rules-generate` |
| עיצוב עקבי / מיתוג | **SLDS / Experience CMS Brand** | `design-systems-slds-apply`, `experience-cms-brand-apply` |
| פריסה לאורג | **Metadata Deploy** | `platform-metadata-deploy` |
| קבצים מצורפים | **ContentVersion / File Upload** | `experience-ui-bundle-file-upload-generate` |

**ארכיטקטורה חלופית (Fallback):** אפליקציית web חיצונית (Node/Express + jsforce +
React + PostgreSQL) שכותבת ל-`Form_Response__c` דרך API. מתאימה אם נדרש בונה-טפסים
end-user ידידותי מאוד שלא קיים ב-OmniStudio, או פרסום מחוץ ל-Experience Cloud.
פחות מומלצת תחת רישוי PSS כי אינה מנצלת את היכולות המובנות ומוסיפה רכיבי תחזוקה.

---

## 4. מודל נתונים — Salesforce (`Form_Response__c`)

**אובייקט Custom גמיש אחד** לכל התשובות מכל הטפסים (החלטה #1).
נוצר ומנוהל דרך `platform-custom-object-generate` + `platform-custom-field-generate`.

| שדה | סוג | תיאור |
|-----|-----|-------|
| `Name` (Auto Number) | Auto | מספר סימוכין, למשל `FR-{00000}` |
| `Form_Name__c` | Text | שם הטופס |
| `Form_External_Id__c` | Text (External Id) | מזהה הטופס |
| `Submitted_At__c` | Date/Time | מועד השליחה |
| `Response_Data__c` | Long Text Area | **כל התשובות כ-JSON** (כולל שדות לא-ממופים) |
| `Respondent_Name__c` | Text | שדה-מפתח ממופה |
| `Email__c` | Email | שדה-מפתח ממופה |
| `Phone__c` | Phone | שדה-מפתח ממופה |
| `Subject__c` | Text | שדה-מפתח ממופה |
| `Status__c` | Picklist | `New` / `In Progress` / `Done` |
| `Source_IP__c` | Text (אופציונלי) | לאבטחה |

**מיפוי שדות:** בזמן הבנייה, שדות טופס נבחרים ממופים לשדות-המפתח; השאר נשמר
ב-`Response_Data__c`. כך ניתן לבנות **כל טופס** בלי לגעת בסכמת SF.

**הגדרת הטופס עצמו** (שדות, ולידציות, לוגיקה) נשמרת כמטא-דאטה של ה-OmniScript ב-SF —
אין צורך במסד נתונים חיצוני.

---

## 5. סוגי שדות (רכיבי OmniScript)

OmniScript מספק את הרכיבים באופן נייטיבי; מיפוי לצרכים:

| צורך | רכיב OmniScript |
|------|------------------|
| טקסט קצר / ארוך | Text / Text Area |
| אימייל, טלפון (IL), מספר, מטבע | Email / Telephone / Number / Currency |
| תאריך / שעה | Date / Time / Date-Time |
| בחירה יחידה | Select / Radio / Lookup |
| בחירה מרובה | Checkbox Group / Multi-select |
| הסכמה (פרטיות) | Checkbox + טקסט/קישור |
| דירוג | Radio מותאם (כמו "דחיפות" הקיים) |
| כותרת/מקטע/הסבר | Step / Block / Text (display) |
| קובץ | File component (ContentVersion) |
| שדה מוסתר | Set Values / URL param |

---

## 6. ולידציות

- ולידציות מובנות ב-OmniScript: חובה, פורמט (אימייל/טלפון/מספר), regex,
  min/max, טווחי תאריכים, הודעות שגיאה מותאמות.
- ולידציות מורכבות/חוצות-שדות: **Business Rules Engine** (PSS) או Validation Rules
  ברמת הרשומה (`platform-validation-rule-generate`).
- **אכיפה כפולה:** ולידציה בטופס (חוויית משתמש) + ולידציה ברמת הרשומה/BRE בעת השמירה —
  לא לסמוך על הקלט בלבד.

---

## 7. לוגיקה מותנית (Conditional Logic)

OmniScript מספק **Conditional View** ו-**Show/Hide** לפי ערך שדה אחר, וכן ניווט מותנה
בין שלבים — נייטיבית, ללא קוד. דוגמה: "צריך הסעה? = כן" → הצגת שדה "כתובת איסוף".
לחוקים עסקיים מורכבים יותר — Business Rules Engine.

---

## 8. עיצוב והתאמה אישית

- **SLDS** לעקביות ונגישות (`design-systems-slds-apply`) — RTL נתמך.
- **Experience Builder** לעיצוב הדף/אתר (צבעים, לוגו, פריסה) ללא קוד.
- **Experience CMS Brand** להחלת מיתוג אחיד (`experience-cms-brand-apply`).
- דף תודה / הפניה מוגדרים ב-OmniScript (Step סיום) או ב-Experience Builder.
- שימור שפת העיצוב הקיימת (לוגו `MASHAM_LOGO.png`, RTL, כחול) כתבנית מותג.

---

## 9. פרסום וניהול מחזור-חיים

- **פרסום:** אתר Experience Cloud עם Guest User; ה-OmniScript מוטמע בדף ציבורי
  (`experience-ui-bundle-site-generate`). כתובת ציבורית ידידותית לכל טופס.
- **טיוטה/פרסום:** גרסאות OmniScript (Draft → Activate) — ניתן לערוך בלי לשבור פרסום.
- **פתיחה/סגירה, מכסות:** דרך הגדרות + Flow (למשל סגירה אוטומטית במכסת נרשמים).
- **הטמעה חיצונית (iframe):** אפשרי כשלב עתידי.

---

## 10. זרימת שליחה

1. הפונה (Guest) פותח את דף האתר → ה-OmniScript נטען ומרונדר.
2. מילוי; **ולידציה + לוגיקה מותנית** נייטיבית בזמן אמת.
3. שליחה → **Integration Procedure / DataMapper** כותב `Form_Response__c` (מיפוי + JSON).
4. **קבצים** נשמרים כ-ContentVersion ומקושרים לרשומה.
5. **Record-Triggered Flow** מפעיל לוגיקת המשך (Contact/Campaign/Case/Email).
6. הצגת מסך תודה + מספר סימוכין.

**חוסן ואבטחה:** הגבלת קצב (Guest limits + Shield/Event Monitoring), הגנת ספאם
(honeypot/captcha ב-OmniScript), מניעת כפילויות, ולידציה בשרת.

---

## 11. הזדהות והרשאות

- **בונה/מנהל:** התחברות נייטיבית ל-Salesforce (החלטה #3). הרשאות דרך Permission Sets
  (`platform-permission-set-generate`).
- **פונה:** **Guest User** של אתר Experience Cloud — אנונימי, ללא התחברות. הרשאה
  מינימלית: create בלבד ל-`Form_Response__c` + create ל-ContentVersion.
- **Sharing:** כללי שיתוף (`platform-sharing-rules-generate`) לחשיפת רשומות למנהלים
  בלבד; ה-Guest לא רואה תשובות של אחרים.

---

## 12. אבטחה ופרטיות

| תחום | אמצעי |
|------|-------|
| קלט | ולידציה נייטיבית + BRE/Validation Rules בעת השמירה |
| Guest | הרשאות מינימום; Sharing מחמיר; הגבלות Guest של הפלטפורמה |
| ספאם | honeypot / captcha ב-OmniScript |
| פרטיות | שדה הסכמה + קישור למדיניות; חוק הגנת הפרטיות (ישראל) / GDPR |
| ניטור | Event Monitoring / Shield; אודיט מובנה |
| שמירה | מדיניות שמירה/מחיקה; שדות רגישים לפי הצורך |

---

## 13. מפת דרכים (שלבים)

### שלב 0 — אפיון (המסמך הזה) ✅ + התקנת ספריית הסקילים

### שלב 1 — MVP נייטיבי
- יצירת `Form_Response__c` + שדות + Permission Set (Guest + מנהל).
- OmniScript ראשון (סוגי שדות ליבה, ולידציות, פריסה רב-שלבית).
- DataMapper/Integration Procedure לשמירה.
- אתר Experience Cloud + פרסום ציבורי.
- ניהול תשובות ב-SF (List View / Report).

### שלב 2 — תכונות מתקדמות
- לוגיקה מותנית מלאה + Business Rules Engine.
- העלאת קבצים.
- **תבנית אירוע/רישום** + Record-Triggered Flow (Contact + Campaign + מייל אישור).
- מכסות ותאריכי פתיחה/סגירה.
- מיתוג/עיצוב מתקדם (Brand, SLDS).
- גלריית תבניות OmniScript.

### שלב 3 — הרחבות
- Case Management / Licenses & Permits (PSS) לטפסים תהליכיים.
- Data Cloud לאיחוד פרופילים; Agentforce לשירות/מענה אוטומטי.
- תשלומים · הטמעה/iframe · דשבורדים · רב-לשוני · חתימה דיגיטלית · נגישות AA.

---

## 14. הגירת הטופס הקיים

"טופס פתיחת פנייה" הקיים הופך ל-OmniScript ראשון (תבנית לדוגמה), תוך שימור העיצוב.
השליחה עוברת מ-Web-to-Lead ל-`Form_Response__c` (ואם רוצים Lead/Case — דרך Flow).
אין רגרסיה בפונקציונליות; הטופס הופך למקרה-בוחן ראשון של המערכת הנייטיבית.

---

## 15. סיכונים ושאלות פתוחות

| נושא | פירוט / המלצה |
|------|----------------|
| קלות שימוש לבונה | OmniScript Designer הוא כלי אדמין; אם נדרש בונה end-user ידידותי מאוד — לשקול את החלופה החיצונית (סעיף 3) לצד הנייטיבי |
| רישוי OmniStudio / Experience Cloud | לוודא שכלול בחבילת ה-PSS של הארגון |
| מגבלות Guest User | הגבלות create/visibility; לתכנן Sharing בקפידה |
| נפחים גבוהים | Bulkification ב-Flows/Integration Procedures |
| נגישות (a11y) | SLDS מסייע; לבדוק תקן AA בטפסים הציבוריים |
| רגולציה | חוק הגנת הפרטיות / GDPR — הסכמות ושמירה |

---

## נספח: ספריית הסקילים

הותקנה `forcedotcom/sf-skills` (87 סקילים) תחת `.agents/skills/` (סימלינקים ל-Claude
Code תחת `.claude/skills/`), עם `skills-lock.json`. **חובה** להשתמש בסקיל הרלוונטי
בכל פיתוח SF (ראו `CLAUDE.md`). רענון: `npx skills add forcedotcom/sf-skills`.

*סוף מסמך האפיון · גרסה 2.0*
