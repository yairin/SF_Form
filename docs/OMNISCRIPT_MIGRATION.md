# גל 4 — הסבת טפסים ל-OmniScript (מדריך בנייה + Retrieve)

**מדוע לא בקוד ישירות:** חיבור ידני של OmniScript מלא (עץ `propertySetConfig` לכל אלמנט)
הוא שביר ותלוי-גרסה, ולרוב לא יתקמפל/יופעל. גם ה-skill הרשמי יוצר אותם ב-Designer/REST.
המסלול המהימן: **לבנות ב-OmniStudio Designer → Retrieve ל-`force-app` → מכאן ה-CI פורס כרגיל.**

## סוג המטא-דאטה (v62.0)
- סוג: **`OmniScript`** (לא `OmniProcess`); תיקייה `force-app/main/default/omniScripts/`, סיומת `*.omniScript-meta.xml`.
- `OmniProcessCompilation` נוצר ע"י הארגון בעת Activation — **לא לחבר/לפרוס ידנית.**
- אם הארגון חושף רק את הסוג המונוליטי `OmniProcess` — להשתמש בשם זה ב-retrieve/deploy.

## בניית "בקשה כללית" ב-Designer
1. App Launcher → **OmniStudio** → לשונית **OmniScripts** → **New**.
2. Triplet: **Type** `GeneralRequest`, **SubType** `Intake`, **Language** `Hebrew` (ה-RTL נגזר מהשפה/Locale — אין דגל RTL נפרד).
3. **שלב 1 — "פרטי המבקש":** Text `FullName`, Text `NationalId`, Email `Email`, Telephone `Phone`.
4. **שלב 2 — "פרטי הבקשה":** Text Area `RequestDetails`.
5. **שלב 3 — "סקירה ושליחה":** Step + Text Block עם merge fields, ושליחה (ברירת מחדל של OmniScript, או Submit Action / Integration Procedure בהמשך).
6. תוויות בעברית, סימון שדות חובה → **Activate**.

## Retrieve ל-source (כדי שה-CI יפרוס)
```bash
sf project retrieve start --metadata "OmniScript:GeneralRequest_Intake_Hebrew" --target-org <alias>
# אם נחשף רק הסוג הישן:
sf project retrieve start --metadata "OmniProcess:GeneralRequest_Intake_Hebrew" --target-org <alias>
```
Commit את הקבצים שנוצרו תחת `omniScripts/`; מכאן `sf project deploy start --source-dir force-app` פורס אותם.

## מיפוי שדות
| שדה | סוג אלמנט | שם |
|---|---|---|
| שם מלא | Text | `FullName` |
| ת"ז | Text | `NationalId` |
| דוא"ל | Email | `Email` |
| טלפון | Telephone | `Phone` |
| פרטי הבקשה | Text Area | `RequestDetails` |
| סקירה/שליחה | Step (+ Text Block/Submit) | `ReviewSubmit` |

## הסתייגויות
- לפרוס עם `isActive=true` מפעיל קומפילציה ביעד; אם טופס לא נפתח — deactivate/reactivate בארגון (התנהגות OmniStudio צפויה).
- לוודא שהגדרת "OmniStudio Metadata" מופעלת (חושפת את הסוג `OmniScript`); אחרת להשתמש ב-`OmniProcess`.
- מומלץ להתחיל בטופס פשוט אחד, לאמת מקצה-לקצה, ואז להסב טפסים נוספים; הטפסים הקיימים (LWC) נשארים פעילים במקביל עד להצדקה.
