# בידוד גישה פר-רשות תחת org אחד — Runbook (MT-3)

מסמך זה מתאר את הפעלת **בידוד הגישה** כך שכל משתמש רואה רק את נתוני הרשות שלו.
⚠️ יש לבצע **בסדר הזה בדיוק** — הפעלת הבידוד לפני שיוך המשתמשים תנעל את האפליקציה.

---

## ✅ מצב עדכני (מה שמיושם בפועל)

**Phase A — תשתית בידוד (פרוס וירוק ב-CI):**
- שדה טקסט `Form_Template__c.Authority_Code__c` (מפתח הבידוד לתבניות) + `Form_Response__c.External_Case_Ref__c`.
- החתמת קוד-הרשות בשמירה/שכפול טופס (`FormBuilderController`) ובניתוב תגובות (`FormRoutingService`),
  דרך ה-lookup `Authority__c`; `Form_Response__c.Authority_Code__c` הוא שדה **נוסחה** ולכן
  הקוד לבידוד תגובות נשמר בשדה הכתיב `Tenant_Code__c`.
- סקריפט `scripts/backfill-authority.apex` (מחובר ל-`deploy-org.yml`): מקים רשות דמה
  `0000 / MuniForceCity`, מחתים משתמשים (best-effort — מדלג על משתמשים שחוסמים בגלל
  ולידציית `Municipal__c`), תבניות ותגובות קיימות.

**אכיפה — שכבת Apex (פרוס וירוק), לא Restriction Rules:**
> **מגבלת פלטפורמה:** האורגן הזה דוחה קריטריון של שדה-משתמש מותאם
> (`$User.Authority_Code__c`) בתוך `recordFilter` של Restriction Rule
> ("cannot create restriction rules with this user criterion"), וה-recordFilter
> מאומת גם כשהכלל כבוי. בנוסף כללי הגבלה תומכים רק ב-`Equals` (בלי `OR`, בלי שדות נוסחה),
> ולכן גם חריג הגלריה (`שלי OR משותף`) לא ניתן לביטוי. לכן קבצי ה-`restrictionRules/`
> נשמרים בקוד אך **מוחרגים מהפריסה** (`.forceignore`).

הבידוד נאכף במחלקה `AuthorityScope` — **fail-closed**:
- **לא-מוגבל רק עם "View All Data"** (אדמין טכני/מפתח). כל שאר המשתמשים מוגבלים לרשות שלהם,
  ומשתמש עסקי ללא קוד → לא מתאים לאף רשומה מוחתמת → **רואה כלום** (ולא דולף).
- שאילתות דפדוף מסוננות: `FormBuilderController.listForms/listFormsDetailed` לפי
  `Authority_Code__c`, ספירת התגובות + `FormResultsController.listResponses/getResults`
  לפי `Tenant_Code__c`. `getTemplate` / `getResponseDetail` חוסמים גישה חוצת-רשות לרשומה בודדת.
- **הגלריה** (`listGallery`) והגשת אורחים (`FormResponseController`) נשארות ללא הגבלה בכוונה.

**Provisioning של קוד-הרשות:** Flow `Set_User_Authority_Code_From_Municipal` (before-save על User,
create+update) גוזר `Authority_Code__c ← Municipal__c` (קוד-ישוב למ"ס). כך הקוד תמיד מסונכרן
ואינו נחסם ע"י ולידציית `Municipal__c`.

**מודל שדות (מאוחד):** מפתח הבידוד לתגובה = `Tenant_Code__c` (שדה טקסט יחיד, נחתם רק ע"י הניתוב,
read-only למנהלים). `Authority__c` (lookup) נשמר לרלציה/דוחות. שדה הנוסחה `Authority_Code__c`
על התגובה **הוסר מהמקור** (מיותר; מחיקה פיזית בארגון — צעד אדמין אופציונלי, אין בו נתונים).

### Runbook הפעלת הכלל (הסדר מחייב — fail-closed!)
1. **פרוס** את ה-Flow והקוד (כבר ב-CI). ודא שה-Flow פעיל.
2. **הרץ provisioning** על משתמשים קיימים (עדכון כלשהו מפעיל את ה-Flow, או Data Loader על Municipal__c).
3. **בקרת 0** — חייב להחזיר ריק לפני הפעלת הכלל:
   ```sql
   SELECT Id, Name FROM User
   WHERE IsActive = true AND UserType = 'Standard' AND Authority_Code__c = null
   ```
4. **צור משתמשי בדיקה:** `sf apex run --file scripts/provision-test-users.apex --target-org <org>`
   (שני משתמשים לא-אדמין, קודים 0000 ו-4000). היכנס כל אחד → ודא שרואה רק את הרשות שלו.
5. **הפעל את Restriction Rule** ב-Setup על `Form_Response__c`: New Restriction Rule,
   Record Filter `Tenant_Code__c Equals $User.Authority_Code__c`, Enforcement = Restrict, Active.
   (המטא-דאטה נדחית ב-org הזה, לכן יוצרים ב-UI; הקובץ ב-`restrictionRules/` משמש תיעוד.)
6. **אימות סופי + Rollback:** כיבוי הכלל מחזיר מיידית.

---

## מה כבר פרוס (בטוח, ללא השפעת גישה)
- אובייקט `Authority__c` + שדות config פר-רשות.
- Lookup `Authority__c` על טפסים/פניות/מחלקות/סוגי-שירות + חותמת אוטומטית בפנייה.
- **שדה `Authority_Code__c` על ה-User** (מיפוי משתמש→רשות; טקסט התואם ל-`Authority__c.Code__c`).

## שלבי הפעלה (מלווים, חלקם קליקים ב-Setup)

### 1. צור רשויות ושייך נתונים
- טאב **Authority** → צור רשומה לכל רשות (שם + Code). הזן config/מפתח AI פר-רשות אם צריך.
- שייך תבניות/מחלקות/סוגי-שירות קיימים ל-Authority המתאימה (שדה Authority בכל רשומה).
- פניות חדשות ייחתמו אוטומטית; פניות ישנות — עדכן Authority בכמות (Data Loader) אם נדרש.

### 2. שייך משתמשים לרשות
- לכל משתמש פנימי: שדה **Authority Code** על ה-User → הקוד של הרשות שלו (תואם ל-Authority.Code).
- ודא שלכל המשתמשים הרלוונטיים (כולל אדמין שמנהל רשות) יש Authority Code.

### 3. הסר "View All" מה-Permission Set (אחרת מנהלים רואים הכל)
- ב-`SF_Forms_Manager`: לאובייקטים Form_Response/Form_Template/Department/Service_Type —
  הורד `viewAllRecords` (וגם `modifyAllRecords` אם רוצים בידוד עריכה).
  *(אפשר לפרוס גרסה מעודכנת של ה-permission set — אעשה זאת כשנגיע לשלב.)*

### 4. OWD = Private
- Setup → Sharing Settings → הגדר Org-Wide Default = **Private** ל-4 האובייקטים.

### 5. בידוד — בחר גישה:
**א. Restriction Rules (מומלץ, נייטיב):** לכל אובייקט → Restriction Rules → New:
- Target: כל המשתמשים.
- Record filter: `Authority__r.Code__c EQUALS $User.Authority_Code__c`
- זה מגביל כל משתמש לרשומות הרשות שלו. (משתמש ללא רשות — לא יראה רשומות מסומנות.)

**ב. Sharing Rules + Public Groups:** קבוצה ציבורית לכל רשות + Owner/Criteria-based
sharing rule ששיתף רשומות Authority=X לקבוצת הרשות. גמיש יותר לשיתוף חוצה-רשויות.

### 6. אימות
- התחבר כמשתמש של רשות א' → ודא שרואה רק פניות/טפסים של רשות א'.
- התחבר כמשתמש של רשות ב' → ודא בידוד.

## הערה על אורחים (ציבורי)
הבקרים רצים `without sharing`, כך שהגשה אנונימית ממשיכה לעבוד; הפנייה נחתמת
ברשות של התבנית. אין צורך ב-sharing rule לאורח.

## Rollback
אם משהו נראה שגוי — השבת את ה-Restriction Rules והחזר OWD ל-Public Read/Write;
הגישה חוזרת למצב הקודם מיידית.
