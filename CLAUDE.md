# CLAUDE.md — הנחיות פרויקט

## ⚠️ הנחיית חובה לפני כל פיתוח Salesforce

**לפני כל עבודת פיתוח מול Salesforce, תמיד:**

1. **להשתמש בספריית הסקילים הרשמית של Salesforce** (`forcedotcom/sf-skills`) —
   מותקנת בפרויקט תחת `.agents/skills/` (סימלינקים ל-Claude Code תחת `.claude/skills/`).
   לרענן לגרסה עדכנית בעת הצורך:
   ```bash
   npx skills add forcedotcom/sf-skills
   ```
   להשתמש בסקיל ה-`platform-*` / `automation-*` / `omnistudio-*` / `experience-*`
   הרלוונטי (למשל `platform-custom-object-generate`, `platform-metadata-deploy`,
   `platform-permission-set-generate`, `automation-flow-generate`,
   `omnistudio-omniscript-generate`, `platform-validation-rule-generate`).

2. **לנצל את מלוא יכולות רישוי PSS (Public Sector Solutions)** ואת כלל היכולות
   הנייטיביות של Salesforce — לא להסתפק בפתרונות חיצוניים כשקיימת יכולת מובנית
   (OmniStudio, Experience Cloud, Business Rules Engine, Flows, Metadata API,
   Permission Sets, Data Cloud, Agentforce וכו').

3. **להעדיף גישה Native-first** לפי הסקילים והיכולות של הפלטפורמה, ולתעד כל החלטת
   אינטגרציה.

> הנחיה זו חלה תמיד ואינה חד-פעמית.

## מסמכים
- **תכנון פתרון מלא (רשות מקומית):** `docs/SOLUTION_ARCHITECTURE.md`
- מדריך מעשי (יצירה/מילוי/בחינת תוצאות): `docs/QUICKSTART.md`
- אפיון מחולל הטפסים: `docs/FORM_BUILDER_SPEC.md`
- אפיון מחולל הדוחות: `docs/REPORT_GENERATOR_SPEC.md`
- מסלול נייטיבי (LWC + Experience Cloud): `docs/NATIVE.md`
- פריסת מטא-דאטה (SFDX): `docs/DEPLOY.md`

## קוד מקור (Salesforce DX)
- מטא-דאטה נייטיבית תחת `force-app/` — אובייקטים `Form_Response__c` / `Form_Answer__c`,
  טריגר + Apex לפירוק JSON, Permission Sets, ו-Report Type. פריסה לפי `docs/DEPLOY.md`.

## ענף פיתוח
- `claude/form-builder-system-kf36td`
