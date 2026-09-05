# בקשת מידע ממנהל ה-ORG (Salesforce) המוקד

מסמך זה מיועד לשליחה למנהל ה-Salesforce Org החיצוני שאליו רוצים להתחבר (בנפרד מה-Web-to-Lead הפשוט שכבר קיים בפרויקט זה). המטרה: לקבל את כל המידע הדרוש כדי לבנות אינטגרציה מלאה (API, לא Web-to-Lead/Web-to-Case) שיוצרת/מעדכנת רשומות עם שיוך לעובד שטח, כתובת ביצוע וסוג קריאה.

הערה על ההיסטוריה של הפרויקט: בעבר נעשה ניסיון לעבור מ-Web-to-Lead ל-Web-to-Case (commit `94987a0`), אך הוחזר ל-Web-to-Lead כי זה "עבד" (`50870a6`). כדי לתמוך בשיוך עובד שטח וכתובת בצורה אמינה, נדרש מעבר לחיבור API אמיתי (REST API / jsforce שכבר מוגדר כתלות ב-`package.json` אך לא בשימוש בפועל כרגע) ולא טופס Web-to-*.

---

## 1. זיהוי האובייקט ושדות המפתח

לבקש מהמנהל להריץ ב-Developer Console → Query Editor (SOQL), ולשלוח את התוצאה:

```sql
SELECT Id, Subject, Status, Priority, OwnerId, Description FROM Case LIMIT 1
```

אם אין תוצאה או שהאובייקט `Case` לא רלוונטי, לבקש לנסות גם:

```sql
SELECT Id, Subject, Status, OwnerId FROM WorkOrder LIMIT 1
```

**חשוב לוודא גם:**
- אילו **Record Types** מוגדרים על האובייקט (אם בכלל), ואיזה מהם רלוונטי לפניות מהטופס.
- רשימת **השדות החובה (required)** ליצירת רשומה חדשה באובייקט הזה — אפשר לבקש להריץ ב-Setup → Object Manager → [Object] → Fields, ולסמן אילו שדות הם Required.
- גרסת ה-API הנתמכת (למשל `v59.0` ומעלה).

---

## 2. פרטי חיבור (Integration User + Connected App)

לבקש מהמנהל להקים בצד שלו:

1. **Connected App** חדש (Setup → App Manager → New Connected App):
   - Enable OAuth Settings
   - Callback URL (יש לתאם כתובת עם הפרויקט, למשל `https://<production-domain>/callback`)
   - Selected OAuth Scopes: `api`, `refresh_token`
   - **Consumer Key + Consumer Secret** — לשלוח בערוץ מאובטח (לא במייל/צ'אט רגיל)

2. **Integration User** ייעודי (לא משתמש אישי):
   - **Profile / Permission Set** עם הרשאות Create/Edit על האובייקט הרלוונטי (Case / WorkOrder) ועל כל השדות הדרושים (Field-Level Security)
   - לוודא שהמשתמש **לא** כפוף ל-MFA שחוסם התחברות API אוטומטית, או לחלופין לקבל Security Token תקף
   - **Trusted IP Ranges / IP Relaxation** — אם השרת שלנו רץ מ-IP קבוע (למשל Railway), לבדוק אם צריך להוסיף אותו ל-IP Ranges של הפרופיל כדי לא להיתקע על אימות נוסף

3. לאשר: **Sandbox** או **Production**? (משפיע על `login URL`: `test.salesforce.com` מול `login.salesforce.com`)

---

## 3. שדות ספציפיים לאפליקציה

לבקש את **שמות ה-API** (API Name, לא רק ה-Label) של השדות הבאים באובייקט שנבחר:

| מידע נדרש | שדה סטנדרטי אפשרי | שאלה למנהל |
|---|---|---|
| עובד שטח משויך | `OwnerId` | האם השיוך מתבצע דרך `OwnerId` הרגיל, או שיש שדה custom כמו `AssignedTechnician__c`? האם זה Lookup ל-User או ל-Object נפרד (למשל Service Resource)? |
| כתובת ביצוע | — | האם יש שדה טקסט (`Address__c`) או שדה Geolocation (`Site__c`, `Geolocation__c`)? האם יש אובייקט `Address`/`Site` נפרד שמקושר? |
| סוג/קטגוריה של הקריאה | `Type` / `Origin` | מה שם השדה (`Category__c`? `Type`?) ומהן **ערכי ה-Picklist** המדויקים (כדי שנוכל למפות את בחירות המשתמש בטופס לערכים הנכונים)? |
| דחיפות/עדיפות | `Priority` | האם יש ערכים מותאמים אישית מעבר ל-Low/Medium/High? |
| סטטוס | `Status` | מהם ערכי ה-Picklist האפשריים לסטטוס פתיחה ראשוני? |

---

## סיכום — מה לשלוח בחזרה

1. תוצאת ה-SOQL (סעיף 1) + רשימת שדות חובה + Record Types
2. Consumer Key + Consumer Secret של ה-Connected App, ופרטי ה-Integration User (username, אם צריך Security Token נפרד)
3. טבלת מיפוי שדות מלאה (סעיף 3) כולל ערכי Picklist מדויקים
4. אישור אם מדובר ב-Sandbox או Production
