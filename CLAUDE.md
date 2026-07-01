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
- אפיון המערכת: `docs/FORM_BUILDER_SPEC.md`

## ענף פיתוח
- `claude/form-builder-system-kf36td`
