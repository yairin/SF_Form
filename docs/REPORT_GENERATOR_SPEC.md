# אפיון ותכנון פיתוח: מחולל הדוחות — "SF Forms Reports"

> מסמך תכנון פיתוח · גרסה 1.0 · Native-first על גבי Salesforce PSS
> משלים את `docs/FORM_BUILDER_SPEC.md` (מחולל הטפסים).

---

## 1. הקשר ומטרה

מחולל הטפסים אוסף תשובות לאובייקט `Form_Response__c`. **מחולל הדוחות** נותן לגורם
לא-טכנולוגי להפיק מהתשובות תובנות ומסמכים: לוחות מחוונים (Dashboards), דוחות
אנליטיים, מסמכים מעוצבים (PDF/Word) ויצוא נתונים — הכל **נייטיבי בתוך Salesforce**,
תוך ניצול מלא של רישוי **PSS (Public Sector Solutions)**.

**דוגמה:** לאירוע עם 312 נרשמים — לוח מחוונים חי (כמה נרשמו, לפי מסלול, כמה צריכים
הסעה, סטטוס טיפול), דוח נרשמים לייצוא, ומסמך רשימת-נוכחות מעוצב להדפסה.

---

## 2. עקרונות מנחים

1. **Native-first** — Reports & Dashboards, Document Generation, Subscriptions —
   לפני כל פתרון חיצוני (מתועד ב-`CLAUDE.md`).
2. **ניצול רישוי PSS** ו-OmniStudio (DocGen), CRM Analytics אם מורשה.
3. **שימוש בסקילים** `forcedotcom/sf-skills` (למשל `platform-metadata-deploy`,
   `automation-flow-generate`, `platform-permission-set-generate`).

---

## 3. אתגר מרכזי: הפיכת התשובות ל-Reportable

תשובות הטופס נשמרות כ-JSON בשדה `Response_Data__c`. **Salesforce Reports אינו יכול
לדווח על שדות בתוך טקסט JSON.** לכן, כדי לאפשר פילוחים לפי כל שדה בטופס (למשל "כמה
בחרו כל מסלול"), נוסיף אובייקט-בן:

### `Form_Answer__c` (שורה לכל תשובה בודדת)
| שדה | סוג | תיאור |
|-----|-----|-------|
| `Form_Response__c` | Master-Detail | קישור לרשומת התשובה |
| `Field_Key__c` | Text | מזהה השדה (למשל `track`) |
| `Field_Label__c` | Text | תווית תצוגה |
| `Value_Text__c` | Text | ערך טקסטואלי |
| `Value_Number__c` | Number | ערך מספרי (לסכומים/ממוצעים) |
| `Value_Date__c` | Date | ערך תאריך |

**מנגנון:** Record-Triggered Flow (או Apex) על יצירת `Form_Response__c` **מפרק את
ה-JSON** לרשומות `Form_Answer__c`. כך כל שדה הופך לניתן-לדיווח, לפילוח ולסינון —
בלי לשנות סכמה לכל טופס.

---

## 4. מודל הדיווח

- **Custom Report Types** (`platform-metadata-deploy`):
  - "Form Responses" — דיווח ברמת הפנייה (שדות מפתח, סטטוס, תאריך).
  - "Form Responses with Answers" — Response + Form_Answer__c לפילוח לפי כל שדה.
- **Reports**: טבלאי / סיכום (Summary) / מטריצה (Matrix), עם קיבוצים, סינונים,
  שדות מחושבים (Bucket/Formula) ותרשימים מוטמעים.
- **Dashboards**: כרטיסי KPI, עמודות, דונאט, מגמות — עם רענון אוטומטי.

---

## 5. רכיבי מחולל הדוחות

| רכיב | יכולת נייטיבית | סקיל |
|------|----------------|------|
| דוחות אנליטיים | **Reports** (Report Builder) | — (מובנה) + `platform-metadata-deploy` |
| לוחות מחוונים | **Dashboards** | `platform-metadata-deploy` |
| פירוק JSON לדיווח | **Record-Triggered Flow / Apex** | `automation-flow-generate`, `platform-apex-generate` |
| מסמכים מעוצבים | **OmniStudio Document Generation** (PDF/Word) | `omnistudio-integration-procedure-generate`, `omnistudio-datamapper-generate` |
| יצוא נתונים | **Report Export** (Excel/CSV), Data Loader | — |
| הפצה מתוזמנת | **Report/Dashboard Subscriptions** (מייל) | — |
| הפצה חיצונית | **Experience Cloud / CRM Analytics embed** | `experience-ui-bundle-site-generate` |
| הרשאות | **Report Folders + Permission Sets + Sharing** | `platform-permission-set-generate`, `platform-sharing-rules-generate` |
| נראות מודרנית | **SLDS / Brand** | `design-systems-slds-apply`, `experience-cms-brand-apply` |

---

## 6. חוויית "מחולל" למשתמש לא-טכני

- **Report Builder / Dashboard Builder** הנייטיביים — גרירה ויזואלית, ללא קוד.
- **גלריית תבניות מוכנות** לכל סוג טופס (אירוע, פנייה, סקר): דוח + דשבורד שנפרסים
  אוטומטית עם יצירת הטופס, כך שהמשתמש מקבל דוחות "מהקופסה".
- **אשף אופציונלי (LWC)** לבחירת טופס → יצירת דוח/דשבורד מתבנית בלחיצה.

---

## 7. הרשאות ואבטחה

- **Report/Dashboard Folders** עם שיתוף מבוקר (צפייה/עריכה) לפי תפקיד.
- **Field-Level Security** לשדות רגישים; **Sharing Rules** לרשומות.
- הפצה חיצונית (Experience Cloud) — נתונים מסוכמים בלבד, ללא חשיפת פרטים אישיים
  מעבר לנדרש; עמידה בחוק הגנת הפרטיות / GDPR.

---

## 8. שפת עיצוב מודרנית (Design Language)

סטנדרט עיצוב אחיד ומודרני לכל המערכת — טפסים ציבוריים, דשבורדים ומסמכים:

- **פלטת צבעים:** אינדיגו `#4F46E5` / כחול `#2563EB` (ראשי), טורקיז `#06B6D4` וסגול
  `#7C3AED` (משני), ניטרלים חמים (slate), הצלחה `#10B981`, אזהרה `#F59E0B`.
- **טיפוגרפיה:** גופן sans מודרני (Inter / Assistant / Heebo לעברית), היררכיה ברורה,
  מרווח נשימה נדיב.
- **רכיבים:** כרטיסים מעוגלים עם צל רך, כרטיסי KPI, תרשימים נקיים, מצבים ריקים
  ידידותיים, מיקרו-אנימציות.
- **RTL ונגישות:** תמיכת RTL מלאה, ניגודיות תקן AA, מצבי פוקוס ברורים.
- מיושם דרך **SLDS Styling Hooks** ו-**Experience CMS Brand** לעקביות.

---

## 9. מפת דרכים

| שלב | תכולה |
|-----|-------|
| **1 — יסודות דיווח** | `Form_Answer__c` + Flow לפירוק JSON; Custom Report Types; דוחות ודשבורד ראשונים; הרשאות/Folders. |
| **2 — תבניות והפצה** | גלריית תבניות דוח/דשבורד לכל סוג טופס; Subscriptions מתוזמנים; יצוא Excel/CSV. |
| **3 — מסמכים ונראות** | Document Generation (PDF/Word) לרשימות/אישורים; שפת עיצוב מודרנית מלאה; אשף LWC. |
| **4 — מתקדם** | הפצה חיצונית (Experience Cloud/CRM Analytics), Data Cloud, תובנות Agentforce. |

---

## 10. סיכונים ושאלות פתוחות

| נושא | הערה |
|------|------|
| נפח `Form_Answer__c` | רשומה לכל תשובה × שדות — לתכנן bulkification, ארכוב, ומחיקה מדורגת. |
| רישוי DocGen / CRM Analytics | לוודא כלול ב-PSS של הארגון. |
| סנכרון בדיעבד | תשובות ישנות שנשמרו לפני הוספת `Form_Answer__c` — batch למילוי היסטורי. |
| פרטיות בהפצה חיצונית | חשיפת נתונים מסוכמים בלבד. |

---

*סוף מסמך · גרסה 1.0*
