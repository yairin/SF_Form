# מודול "מאגר חירום" — פיתוח Salesforce (Salesforce DX)

הריפו הזה הוא כעת גם **פרויקט Salesforce DX**, כדי לאפשר עבודה על המודול
**"מאגר חירום"** בסביבת ה‑Sandbox **MashamDev** (משיכת מטא‑דאטה, עריכה, ופריסה
בחזרה) — במקביל לטופס ה‑web שכבר קיים בריפו.

## דרישות מקדימות

- **Salesforce CLI** (`sf`). התקנה: `npm install -g @salesforce/cli`
- **גישת רשת ל‑Salesforce.** ⚠️ סביבת ההרצה המרוחקת הנוכחית **חוסמת** גישה
  יוצאת ל‑`*.salesforce.com` (מדיניות רשת → שגיאת 403). לכן את שלבי ההתחברות,
  המשיכה והפריסה יש להריץ ממכונה עם גישה חופשית (למשל המחשב שלך), או לאחר
  פתיחת מדיניות הרשת של הסביבה. ראה: https://code.claude.com/docs/en/claude-code-on-the-web

## מבנה הפרויקט (החלק של Salesforce)

```
SF_Form/
├── sfdx-project.json          # הגדרת פרויקט DX (login URL = test.salesforce.com)
├── .forceignore               # מה לא לפרוס/למשוך
├── manifest/
│   └── package.xml            # רשימת רכיבי המטא‑דאטה למשיכה
├── force-app/main/default/    # קוד המקור של המטא‑דאטה (מתמלא אחרי retrieve)
└── scripts/
    ├── sf-auth.sh             # התחברות ל‑Sandbox (web login)
    ├── sf-retrieve.sh         # משיכת מטא‑דאטה לתוך force-app/
    └── sf-deploy.sh           # פריסה בחזרה (ברירת מחדל: dry-run בלבד)
```

## שלב 1 — התחברות

```bash
scripts/sf-auth.sh MashamDev
```

נפתח דפדפן, מתחברים עם המשתמש שלך ל‑Sandbox. לא נשמרת שום סיסמה בריפו.
אימות: `sf org display --target-org MashamDev`

## שלב 2 — גילוי ומיקוד (מומלץ)

תחילה מושכים רק את האפליקציה כדי לזהות את ה‑API Name שלה ואת הרכיבים המשויכים:

```bash
scripts/sf-retrieve.sh CustomApplication
```

פותחים את `force-app/main/default/applications/*.app-meta.xml`, מזהים את
הטאבים/רכיבים של "מאגר חירום", ומצמצמים את `manifest/package.xml` לשמות
המדויקים (במקום ה‑`*`), כדי למשוך/לפרוס רק את המודול ולא את כל הארגון.

## שלב 3 — משיכה מלאה

```bash
scripts/sf-retrieve.sh          # לפי manifest/package.xml
```

בודקים את ה‑diff לפני commit: `git status && git diff`

## שלב 4 — עריכה ופריסה

עורכים את הקבצים תחת `force-app/`, ואז:

```bash
scripts/sf-deploy.sh            # dry-run: מאמת בלבד, לא משנה כלום בארגון
scripts/sf-deploy.sh --run      # פריסה בפועל ל‑MashamDev
```

## הערות

- ניתן להגדיר org אחר דרך משתנה סביבה: `SF_ALIAS=MyOrg scripts/sf-retrieve.sh`
- קבצי האימות (`.sfdx/`, `.sf/`) מוחרגים ב‑`.gitignore` — לעולם לא לעשות להם commit.
- זהו **Sandbox** (`test.salesforce.com`); פריסה ל‑Production תדרוש org/alias נפרד.
