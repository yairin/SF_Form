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
1. **Setup → Digital Experiences → Settings** — הפעל אם צריך.
2. **All Sites → New** — בחר תבנית **Build Your Own (LWR)**, תן שם וכתובת.
3. ב-**Experience Builder**: גרור את הרכיב **"Public Form (SF Forms)"** לעמוד. ניתן
   להגדיר את המאפיינים `Form Name` / `Form External Id` בפאנל הימני.
4. **גישת אורח (Guest):** Settings → General → אפשר גישת אורח לאתר; ואז
   **Public Access Settings** → למשתמש ה-Guest הקצה את ה-Permission Set
   **SF_Forms_Public_Submit** (יצירה ל-`Form_Response__c` + הרשאת ה-Apex
   `FormResponseController`).
5. **Publish**. הכתובת הציבורית זמינה ללא התחברות.

## תוצאה
פונה אנונימי ממלא → ה-LWC קורא ל-Apex → נוצרת `Form_Response__c` → הטריגר יוצר
`Form_Answer__c` → ניהול, דוחות ודשבורדים ב-Salesforce (ראו `docs/REPORT_GENERATOR_SPEC.md`).

## חלופת OmniScript (הצהרתית)
`publicForm` (LWC) נבחר כי הוא נייטיבי, ניתן לפריסה ולבדיקה אוטומטית ב-CI, ומתאים
ישירות ל-Experience Cloud. חלופה הצהרתית ב-**OmniStudio OmniScript** אפשרית אך דורשת
ש-OmniStudio יהיה מופעל בארגון ובנייה ב-Designer (DataRaptor → Integration Procedure
→ OmniScript), לפי הסקילים `omnistudio-*`. ניתן להוסיפה כשלב הבא אם רוצים גישה ללא-קוד.
