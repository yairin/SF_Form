# הערכת יכולות PSS מול הפתרון שנבנה

**הנחת עבודה:** לכל המשתמשים יש רישוי Public Sector Solutions (PSS).
**מטרה:** לזהות היכן יכולת נייטיבית של PSS יכולה **להחליף** או **לשפר** רכיב מותאם-אישית שבנינו, לפי גישת Native-first.

> הערה על דיוק: זמינות מדויקת של חלק מהיכולות (IDR, Agentforce, Data Cloud) תלויה ב-SKU הספציפי של PSS ובתוספים (add-ons). מומלץ לאמת מול חבילת הרישוי בפועל לפני מחויבות.

---

## טבלת מיפוי — מה בנינו ↔ מקבילה נייטיבית ב-PSS

| # | הרכיב שבנינו | יכולת PSS נייטיבית | המלצה | ערך |
|---|---|---|---|---|
| 1 | **מחולל טפסים** (formBuilder + Schema JSON) | **Discovery Framework** (Assessments) / **OmniStudio OmniScript** — טפסים מודרכים, רב-שלביים, לוגיקה מותנית | להחליף (הדרגתי) | גבוה |
| 2 | **טופס דינמי ציבורי** (dynamicForm, אשף רב-שלבי) | **OmniScript** בתוך **Experience Cloud (LWR)** | להחליף/להרחיב | גבוה |
| 3 | **ולידציה בצד שרת** (FormValidationService, ת"ז וכו') | **Validation Rules** + **OmniScript validations** + **BRE** | להחליף חלקית | בינוני |
| 4 | **לוגיקת אישור AI** (90%+ אוטומטי / 60–89% ועדה) | **Business Rules Engine** — Expression Sets & Decision Tables | **להחליף** | גבוה מאוד |
| 5 | **בדיקת צרופות + OCR** (הערנו "נדרש OCR") | **Intelligent Document Reader (IDR)** — חילוץ נתונים ממסמכים (Textract) | **להרחיב** | גבוה מאוד |
| 6 | **מסמכים נדרשים / זיהוי חוסרים** (שדות קובץ + ContentVersion) | **Document Checklist Items (DCI)** + **Document Type** — מעקב, העלאה, סטטוס אימות | **להחליף** | גבוה |
| 7 | **בדיקת AI + סיכום + תובנות** (Anthropic callout ישיר) | **Agentforce / Prompt Templates + Einstein Trust Layer** — מעוגן ברשומות | **להחליף** | גבוה |
| 8 | **פנייה יזומה לפונה + סבב חוזר** (requestCompletion, אימיילים) | **Flows** + **DCI reminders** + **Agentforce actions** | להרחיב | בינוני |
| 9 | **העברה למשימת אישור לעובד** (Task) | **Approval Processes** + **Action Plans / Action Plan Templates** | **להחליף** | גבוה |
| 10 | **בידוד רב-רשותי** (Restriction Rules + Tenant_Code) | Restriction Rules (נייטיבי — כבר בשימוש) + Sharing Sets ל-Experience users | להשאיר | — |
| 11 | **דוחות/גרפים בטאב תוצאות** (אגרגציה מותאמת + LWC) | **Reports & Dashboards** / **CRM Analytics** | להרחיב (היברידי) | בינוני |
| 12 | **כרטיס רשומה + ציר זמן התכתבות** (record drill-down) | **FlexCards** + **Timeline** + Related Lists נייטיביים | להרחיב | בינוני |
| 13 | **SLA וניתוב** (FormRoutingService, SLA_Due) | **Case Management** + **Entitlements & Milestones** + **Omni-Channel** | להרחיב/להחליף | בינוני |
| 14 | **מודל נתונים** (Form_Response__c מותאם) | **Public Sector Intake** data model (Individual Application, Case, Benefit…) | לשקול (אימוץ עמוק) | תלוי-מטרה |
| 15 | **מיתוג/favicon אתר** | **Digital Experiences** branding נייטיבי | להשאיר (נייטיבי) | — |

---

## הזדמנויות עם ה-ROI הגבוה ביותר (Native-first)

### 1. Business Rules Engine (BRE) במקום לוגיקת סף בקוד/AI
לוגיקת "90%+ ← אישור אוטומטי, 60–89% ← ועדת חריגים" היא **דטרמיניסטית** ולא צריכה LLM.
- **Decision Table / Expression Set** מבטאים אותה בצורה מוצהרת, **ניתנת לביקורת (audit)**, בלי עלות טוקנים ובלי סיכון הזיה.
- ה-AI מתמקד במה שהוא באמת טוב בו: קריאת מסמכים, זיהוי חוסרים, ניסוח פנייה לפונה.

### 2. Document Checklist Items + Intelligent Document Reader
- **DCI** נותן מודל מובנה של "מסמכים נדרשים" עם סטטוס אימות — במקום שדות קובץ ידניים ולוגיקת חוסר מותאמת.
- **IDR** ממלא בדיוק את הפער שסימנו ("נדרש OCR"): חילוץ אוטומטי של שדות מ-ת"ז/תג נכה/חוו"ד רפואית שהועלו, והזנתם לבדיקה.
- שילוב: IDR מחלץ → BRE מכריע → DCI מסמן חוסרים → Agentforce מנסח פנייה.

### 3. Agentforce + Prompt Templates במקום callout ישיר ל-Anthropic
היום אנו מנהלים מפתח API, endpoint ו-Remote Site ידנית (כפי שראינו — נקודת כשל בקרדיט/ארגון).
- **Prompt Templates** מעוגנים ברשומות (grounding), עם **Einstein Trust Layer** (מיסוך PII, זליגת נתונים, audit), בלי ניהול מפתחות.
- מתאים ל-3 השימושים שלנו: בדיקת הגשה, ניסוח פנייה לפונה, והפקת תובנות בדף התוצאות.

### 4. Approval Processes + Action Plans במקום Task ידני
- **Approval Process** נותן ניתוב אישור לעובד/ועדה עם היסטוריה, אסקלציה והחלטות — במקום Task בודד.
- **Action Plan Template** מייצר אוטומטית את רשימת המשימות לכל בקשה (אמת מסמכים → החלטת ועדה → מכתב לפונה).

---

## מה כדאי להשאיר כפי שהוא
- **Experience Cloud (LWR)** לאתר הציבורי — כבר נייטיבי.
- **Restriction Rules** לבידוד רב-רשותי — כבר נייטיבי ותקין; אפשר להוסיף Sharing Sets למשתמשי Experience.
- **מיתוג/favicon** — דרך Digital Experiences.
- טאב התוצאות המותאם — שימושי כ-UX ייעודי; אפשר לגבות בדשבורדים נייטיביים לניתוח-על.

---

## מסלול מומלץ (היברידי, מדורג)

הפתרון הקיים כבר עובד, בעברית/RTL ומותאם לצורך. לכן — **לא לזרוק, אלא לעבור בהדרגה** לרכיבים נייטיביים היכן שהתועלת ברורה:

1. **גל 1 (תשתית החלטה ומסמכים):** BRE ללוגיקת אישור + DCI/IDR למסמכים. מרוויחים auditability, OCR אמיתי, פחות קוד.
2. **גל 2 (AI מנוהל):** מעבר מ-callout ל-Agentforce Prompt Templates + Trust Layer.
3. **גל 3 (תהליך):** Approval Processes + Action Plans במקום Task ידני; Entitlements ל-SLA.
4. **גל 4 (טפסים):** הסבת טפסים חדשים ל-OmniScript / Discovery Framework; טפסים קיימים נשארים עד להצדקה.

### שיקולים והסתייגויות
- **RTL/עברית:** לוודא תמיכה מלאה ב-OmniScript/Discovery בעברית (בדרך כלל טובה, כדאי לבדוק רכיבים ספציפיים).
- **רישוי מדויק:** IDR/Agentforce/Data Cloud עשויים לדרוש SKU/תוסף מעבר לליבת PSS — לאמת.
- **עלות מעבר:** אימוץ מודל Public Sector Intake המלא (Individual Application וכו') הוא שינוי משמעותי; מוצדק אם צפויה הרחבה לתחומים נוספים (רישיונות, קצבאות, בקשות).
- **עקומת למידה של OmniStudio** מול פשטות ה-LWC הקיים.

---

## סטטוס יישום (מתעדכן)

| המלצה | סטטוס | הערה |
|---|---|---|
| #1 החלטה דטרמיניסטית (BRE-style) | ✅ נפרס | `ApprovalDecisionService` — טבלת החלטה, מנותקת מה-LLM |
| #3 Approval Process נייטיבי | ✅ נפרס | Queue `SF_Forms_Committee` + Approval Process על route=ועדת חריגים + שדה `Approval_Route__c` |
| #2 Agentforce Prompt Templates | ⏳ ממתין להפעלת Einstein GenAI/Agentforce בארגון | המנוע החיצוני (Anthropic) כבר עובד ומספק את אותו ערך |
| OCR / חילוץ ממסמכים | ✅ נפרס (דרך קלוד) | IDR הנייטיבי לא מורשה — במקומו קלוד המולטי-מודלי קורא תמונות/PDF ב-callout הקיים |
| DCI (מסמכים נדרשים) | 🟡 זמין חלקית (DocumentChecklistItem קיים) | ניתן לבנות לאחר השלמת DocumentType |
| Action Plans | ⏳ ממתין להפעלת Action Plans | ניתן לבנות תבנית לאחר הפעלה |
| #4 OmniScript/Discovery | 📋 מתוכנן (גל 4) | הסבת טפסים הדרגתית |

> תשתית CI: תוקנה רגרסיה — כל ה-workflows הועלו ל-Node 22 (הגרסה החדשה של `@salesforce/cli` קורסת על Node 20).

## שורה תחתונה
בהנחת PSS מלא, **4 ההחלפות בעלות ה-ROI הגבוה** הן: **BRE** (לוגיקת אישור), **DCI + IDR** (מסמכים + OCR), **Agentforce/Prompt Templates** (AI מנוהל), ו-**Approval Processes/Action Plans** (תהליך). אלה מפחיתות קוד מותאם, מוסיפות ממשל/ביקורת/אמון, וסוגרות את פער ה-OCR — תוך שמירה על מה שכבר נייטיבי (Experience Cloud, Restriction Rules).
