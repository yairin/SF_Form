# פרומט המשך — מחולל טפסים דיגיטליים (Salesforce-Native) לרשות מקומית

> העתק את הבלוק שבסעיף "פרומט להדבקה" לסשן חדש כדי להמשיך מכאן. שאר המסמך = הקשר מלא.

---

## פרומט להדבקה (Copy-Paste)

```
אתה Salesforce Solution Architect + מיישם בכיר. המשך פרויקט קיים: מחולל טפסים
דיגיטליים לרשות מקומית בישראל, Native-first על Salesforce (רישוי PSS), עברית/RTL,
נגישות. עבוד בענף git: claude/form-builder-system-kf36td.

חובה לפני כל פיתוח SF: להשתמש בסקילים forcedotcom/sf-skills (מותקנים תחת .agents/skills),
ולנצל יכולות PSS (ראו CLAUDE.md). קרא תחילה: docs/PRD.md, docs/SOLUTION_ARCHITECTURE.md,
docs/NATIVE.md, docs/DEPLOY.md, docs/HANDOFF.md.

מגבלת סביבה קריטית: אין Salesforce CLI ואין org מחובר בסביבת ההרצה. פריסה מתבצעת
*רק* דרך GitHub Actions מול ה-Sandbox של הלקוח (mashamdev), עם secret קיים בשם
SF_AUTH_URL במאגר yairin/SF_Form. אין להריץ sf מקומית ואין לבקש credentials בצ'אט.

מחזור פיתוח-פריסה:
1) ערוך מטא-דאטה תחת force-app/.
2) כדי לפרוס בפועל: bump את הקובץ ops/deploy.trigger (שנה שורה), commit+push לענף.
   זה מפעיל את .github/workflows/deploy-org.yml (deploy אמיתי + assign permset
   SF_Forms_Manager + seed נתונים + smoke test). שינוי בקבצי force-app מפעיל גם את
   validate-org.yml (dry-run + Apex tests).
3) עקוב אחרי הריצה דרך ה-API הציבורי (בלי MCP):
   curl -s "https://api.github.com/repos/yairin/SF_Form/actions/workflows/deploy-org.yml/runs?per_page=3"
   ולוגים של job שנכשל דרך כלי ה-GitHub MCP get_job_logs (הורדת לוגים ב-curl חסומה
   ע"י ה-proxy — blob storage מוחזר 403). אפשר להריץ פולינג ברקע עד שהריצה מסתיימת.
4) בדיקות Apex רצות כ-RunSpecifiedTests עם: FormResponseAnswerServiceTest,
   FormResponseControllerTest, FormBuilderControllerTest, FormRoutingServiceTest.
   הוסף כל מחלקת-בדיקה חדשה לשתי ה-workflows.

מה כבר קיים ופרוס ומאומת ב-Sandbox (אל תשבור): מודל Form_Template__c /
Form_Response__c / Form_Answer__c + טריגר FormResponseTrigger (Apex מפרק JSON→Answers
ומנתב); Department__c / Service_Type__c + ניתוב אוטומטי + SLA_Due; בונה טפסים
(LWC formBuilder) + מרנדר דינמי (LWC dynamicForm) + Apex FormBuilder/FormRender/
FormResponseController; Permission Sets SF_Forms_Manager (מלא) ו-SF_Forms_Public_Submit
(Guest, create-only); אפליקציית Lightning "SF Forms" (טאבים: טופס רישום, בונה טפסים,
Form Responses); Page Layout ל-Form Response; Report Type "Form Responses"; CI מלא.

המשימה הבאה (MVP): פרסום ציבורי אנונימי דרך Experience Cloud — חסום כי הפעלת
"חוויות דיגיטליות" נכשלה, וסביר שהסיבה היא ש"הדומיין שלי" (My Domain) לא פרוס.
זה שלב אינטראקטיבי בתוך ה-org (לא ניתן לאוטומציה מלאה): להפעיל Digital Experiences,
ליצור אתר LWR, להציב את הרכיב dynamicForm (property externalId) בעמוד Guest,
ולהקצות למשתמש ה-Guest את ה-Permission Set SF_Forms_Public_Submit. ליווה את המשתמש
צעד-צעד בעברית. הרכיבים כבר מוכנים לכך.

אחרי הפרסום: התראות (Email/SMS) בשינוי סטטוס/חריגת SLA (Flow), שדה העלאת מסמכים
(File Upload → ContentVersion), דשבורד מנהל, אישורים (Approval/Orchestration),
ערבית מלאה. ראו MoSCoW ו-Roadmap ב-docs/PRD.md.

עקרונות: ולידציה בשרת תמיד; הקשחת Guest; ניהול גרסאות; כל תשובה גם ב-Form_Answer__c
לצורך דיווח. שמור על ההחלטות והארכיטקטורה הקיימות; כל שינוי מהותי — נמק.
```

---

## הקשר מלא (לרפרנס)

### מצב הפרויקט
- **ענף:** `claude/form-builder-system-kf36td` (מאגר `yairin/SF_Form`, ציבורי).
- **Sandbox:** `mashamdev` · משתמש `yair@masham.org.il.mashamdev` · Org ID `00DWm000001yNafMAE`
  · Instance `https://localgovernmenteconomicserviceslt2--mashamdev.sandbox.my.salesforce.com`
  · **PSS** (Public Sector Solutions) · API source 62.0 / org 67.0.
- **secret ב-GitHub:** `SF_AUTH_URL` (sfdx auth URL) — מוגדר; ה-CI משתמש בו.

### מה נבנה ונפרס (עובד ומאומת מקצה-לקצה)
| רכיב | קבצים עיקריים |
|------|----------------|
| מודל נתונים | `force-app/main/default/objects/Form_Response__c`, `Form_Answer__c`, `Form_Template__c`, `Department__c`, `Service_Type__c` |
| אוטומציה | `triggers/FormResponseTrigger.trigger`; `classes/FormResponseAnswerService`, `FormRoutingService` |
| Apex controllers | `FormResponseController`, `FormRenderController`, `FormBuilderController` (+ ‎Test‎ classes) |
| בונה + מרנדר | `lwc/formBuilder`, `lwc/dynamicForm`, `lwc/publicForm` |
| UI פנימי | `applications/SF_Forms`, `flexipages/SF_Forms_Home`+`SF_Forms_Builder`, `tabs/*`, `layouts/Form_Response__c-*` |
| הרשאות | `permissionsets/SF_Forms_Manager`, `SF_Forms_Public_Submit` |
| דיווח | `reportTypes/Form_Responses` |
| CI/תשתית | `.github/workflows/{validate-org,deploy-org,salesforce-ci}.yml`, `manifest/package.xml`, `config/project-scratch-def.json`, `scripts/{smoke,seed}.apex`, `ops/deploy.trigger` |

### מלכודות מטא-דאטה שנפתרו (למנוע חזרה)
- **PermissionSet:** אלמנטים מאותו סוג חייבים להיות **מקובצים** ובסדר הסכמה
  (applicationVisibilities → classAccesses → description → fieldPermissions →
  hasActivationRequired → label → objectPermissions → tabSettings); ל-applicationVisibilities
  **אין** `<default>`; `<description>` ≤ 255 תווים.
- **FlexiPage:** רכיב עטוף ב-`itemInstances > componentInstance` + `<identifier>`.
- **Layout:** שדות שנוצרו ב-Metadata API לא נוספים אוטומטית ל-Layout — יש להוסיפם
  ידנית בקובץ ה-Layout; `Name` אינו חוקי כעמודה ב-related list.
- **בדיקות בפריסה:** `RunSpecifiedTests` (לא `RunLocalTests`) כדי לא להיכשל על בדיקות
  לא-קשורות בארגון; assertions מספריים — `intValue()`.
- **JSON דינמי → Apex** (לא Flow) כי מפתחות התשובות לא ידועים מראש.

### מסמכים
`docs/PRD.md` · `docs/SOLUTION_ARCHITECTURE.md` · `docs/FORM_BUILDER_SPEC.md` ·
`docs/REPORT_GENERATOR_SPEC.md` · `docs/NATIVE.md` · `docs/DEPLOY.md` · `docs/QUICKSTART.md`.

### בדיקה ידנית מהירה של הקיים (בתוך הארגון)
App Launcher → **SF Forms** → *בונה טפסים* (הגדר שדות + סוג שירות → שמור → תצוגה חיה →
שלח) → *Form Responses* (מחלקה/סוג שירות/SLA/Answers מולאו אוטומטית).
