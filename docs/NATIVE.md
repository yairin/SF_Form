# מסלול נייטיבי — טופס Lightning על Experience Cloud

מסמך זה מתאר את הרכיב הנייטיבי (LWC + Apex) ואת שלבי החשיפה שלו כטופס ציבורי אנונימי
ב-Experience Cloud, כך שהתשובות נשמרות ל-`Form_Response__c` ומנוהלות ב-Salesforce.

## מה נבנה (נפרס אוטומטית דרך ה-CI)
| רכיב | תיאור |
|------|-------|
| `FormResponseController` (Apex) | מתודת `@AuraEnabled submitResponse(...)` שיוצרת `Form_Response__c` ומחזירה מספר סימוכין. `without sharing` לתמיכה ב-Guest. |
| `publicForm` (LWC) | טופס SLDS נייטיבי (RTL) — שם, אימייל, טלפון, מסלול, "צריך הסעה?" עם **שדה כתובת מותנה**. חשוף ל-Experience Cloud. |
| `FormResponseControllerTest` | בדיקת Apex — יצירה + אימות ש-3 רשומות `Form_Answer__c` נוצרו. |
| הרשאת Apex ב-Permission Sets | `FormResponseController` נוסף ל-`SF_Forms_Public_Submit` (Guest) ו-`SF_Forms_Manager`. |

הטריגר הקיים ממשיך לפרק את `Response_Data__c` ל-`Form_Answer__c` — הדיווח עובד כרגיל.

## חשיפה כטופס ציבורי אנונימי (שלבים חד-פעמיים בארגון)
> **דרישת קדם (חוסם נפוץ):** יש לפרוס תחילה את **My Domain** (הדומיין שלי) —
> ללא דומיין פרוס, הפעלת Digital Experiences נכשלת.
> Setup → **My Domain** → רשום שם דומיין → **Check Availability** → **Register Domain**,
> המתן ל"Registration succeeded", ואז **Deploy to Users**.

0. **My Domain** — ודא שהדומיין רשום ופרוס (ראו דרישת הקדם למעלה).
1. **Setup → Digital Experiences → Settings** — סמן **Enable Digital Experiences**,
   בחר שם דומיין לאתרים ושמור.
2. **All Sites → New** — בחר תבנית **Build Your Own (LWR)**, תן שם וכתובת.
3. ב-**Experience Builder**: גרור את הרכיב **"Dynamic Form (SF Forms)"** לעמוד ובפאנל
   הימני הגדר את המאפיין **Form External Id = `event-registration`** (טופס ציבורי
   שנזרע אוטומטית ע"י `scripts/seed.apex`, פעיל ומנותב ל"תרבות" עם SLA 48 שעות).
   לחלופין ניתן להשתמש ברכיב **"Public Form (SF Forms)"** (שדות קבועים).
4. **גישת אורח (Guest):** Settings → General → אפשר גישת אורח לאתר; ואז
   **Administration → Pages → Public Access Settings** (או פרופיל ה-Guest של האתר)
   → הקצה את ה-Permission Set **SF_Forms_Public_Submit** (יצירה ל-`Form_Response__c`
   + הרשאות Apex `FormResponseController` / `FormRenderController`).
5. **Publish**. הכתובת הציבורית זמינה ללא התחברות.

> הרכיבים `FormRenderController` ו-`FormResponseController` רצים `without sharing`,
> ולכן **אין צורך** בכלל שיתוף (Guest Sharing Rule) — הגישה נשלטת ע"י ה-Permission Set.

## תוצאה
פונה אנונימי ממלא → ה-LWC קורא ל-Apex → נוצרת `Form_Response__c` → הטריגר יוצר
`Form_Answer__c` → ניהול, דוחות ודשבורדים ב-Salesforce (ראו `docs/REPORT_GENERATOR_SPEC.md`).

## חלופת OmniScript (הצהרתית)
`publicForm` (LWC) נבחר כי הוא נייטיבי, ניתן לפריסה ולבדיקה אוטומטית ב-CI, ומתאים
ישירות ל-Experience Cloud. חלופה הצהרתית ב-**OmniStudio OmniScript** אפשרית אך דורשת
ש-OmniStudio יהיה מופעל בארגון ובנייה ב-Designer (DataRaptor → Integration Procedure
→ OmniScript), לפי הסקילים `omnistudio-*`. ניתן להוסיפה כשלב הבא אם רוצים גישה ללא-קוד.
