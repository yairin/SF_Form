# מדריך הקשחת אבטחה — יישום הנחיה 5.35 בפרויקט

מיפוי כל פער אבטחה למצב הנוכחי + צעדי ביצוע מדויקים. מקור הדרישות: הסקיל `sf-secure-development-il` (הנחיית יה"ב 5.35). לכל פריט: **[DEV]** = ניתן ליישום בקוד/מטא-דאטה (אני מבצע); **[ORG]** = הגדרת ארגון/רישוי/DNS (אדמין מבצע ב-Setup); **[MIX]** = שילוב.

---

## 1. סוד מפתח ה-AI → External/Named Credential  [MIX] — עדיפות גבוהה
**מצב היום:** המפתח ב-Custom Setting היררכי `Form_AI_Setting__c.LLM_API_Key__c` (Text). לא מוחזר ללקוח (getSettings מחזיר `hasApiKey` בלבד), אך קריא ב-Apex/SOQL — פער מול "סודות ב-Named Credential".

**יעד:** `callout:Anthropic` עם הזרקת header `x-api-key` מ-External Credential; המפתח נשמר מוצפן ע"י הפלטפורמה, לא בקוד ולא בגיט.

**צעדים (Setup — האדמין; חובה כי הסוד לא יכול לשבת במטא-דאטה):**
1. Setup → **External Credentials** → New:
   - Label/Name: `Anthropic`; Authentication Protocol: **Custom**.
   - Principal: `AnthropicPrincipal` (Named Principal, sequence 1).
   - Custom Header על ה-Named Credential (ראה 3) או Authentication Parameter בשם `ApiKey` על ה-Principal — הזן את מפתח ה-API כאן (מוצפן).
2. Setup → **Named Credentials** → New (SecuredEndpoint):
   - Label/Name `Anthropic`; URL `https://api.anthropic.com`; External Credential = `Anthropic`.
   - Custom Headers: `x-api-key` = `{!$Credential.Anthropic.ApiKey}` · `anthropic-version` = `2023-06-01`.
3. הענקת גישה: הוסף ל-Permission Set (או צור ייעודי) **External Credential Principal Access** ל-`AnthropicPrincipal`, ושייך למשתמשים/למשתמש ה-guest/integration הרלוונטי.
4. **מעבר קוד [DEV]:** לאחר שהאדמין סיים — נחליף ב-`AnthropicClient.sendMessage` את ה-endpoint ל-`callout:Anthropic/v1/messages` ונסיר את הזרקת ה-`x-api-key` הידני (הפלטפורמה תזריק). נשמור fallback ל-Custom Setting עד לאימות, ואז נמחק את `LLM_API_Key__c`.

> הערה: לא פרסתי מטא-דאטה של External Credential אוטומטית — היא דורשת הזנת הסוד ב-Setup וסיכון לשבור את מנוע ה-AI העובד. זו משימת אדמין מכוונת.

## 2. בידוד רב-רשותי — OWD Private + Sharing  [MIX] — עדיפות גבוהה
**מצב:** קיימים `Authority__c`, `Authority_Code__c`, `Tenant_Code__c` על הפניות ואובייקט `Authority__c`. OWD עדיין לא Private.
**צעדים:**
- **[ORG]** Setup → Sharing Settings: OWD ל-`Form_Response__c` ו-`Form_Template__c` = **Private** (Internal + External). זהו שינוי התנהגות — לוודא לפני שיש נתוני אמת רב-רשותיים.
- **[DEV]** להוסיף שדה `Authority__c` למשתמש (או Public Group/Role לכל רשות) + **Sharing Rules / Restriction Rules** לפי רשות; להוסיף מטא-דאטה של הכללים לריפו.
- **[DEV]** מאגר Gallery: דגל `Shared_To_Gallery__c` על התבנית + פעולת "שכפל אליי" (קיים `cloneForm`, נוסיף החתמת Authority).
- נתיב ה-guest (הגשה ציבורית) רץ `without sharing` — לא מושפע; החתמת ה-Authority על הפנייה כבר נעשית ב-`FormRoutingService`.

## 3. הצפנת Shield ל-PII  [ORG] + [DEV]
- **[ORG]** רישוי **Shield Platform Encryption** + הפעלה; ניהול מפתחות ב-HSM (§11).
- **[DEV]** לסמן להצפנה: תעודת זהות ושדות אישיים רגישים (ב-`Form_Answer__c.Value_Text__c` / שדות ממופים). לבחור Deterministic (אם נדרש חיפוש) מול Probabilistic. לשים לב להשפעה על דוחות/SOQL.
- **[DEV]** Data Mask לכל Sandbox (§9.1.13) — אין PII אמת ב-Sandbox.

## 4. סריקת נוזקות לקבצים  [MIX]
**מצב:** ולידציית סוג/תוכן קיימת; אין סריקת נוזקות (SF לא סורק — §16.1).
- **[DEV/ORG]** לשלב שירות AV צד-ג' (למשל דרך callout ל-endpoint סריקה מאושר) בזרימת `attachFiles`: העלאה → הסגר (לא משויך/לא נגיש) → סריקה → שחרור/דחייה. או סריקה אסינכרונית עם חסימת גישה עד לאישור.

## 5. הגדרות Session / CSP / התחברות  [ORG]
להחיל ב-Setup (§14–15): MFA לכל המשתמשים; Session Timeout 15ד' (חיצוני)/≤2ש' (פנימי); Lock session ל-IP/domain; **Strict CSP = On**; Clickjack/XSS/Content-Sniffing = On; `Enforce login IP ranges on every request`; להשבית `setPassword() self-reset`; להשבית Self-Service portals. הקוד כבר תואם Strict CSP (אין CDN/inline; מדיה/גופן ב-Static Resource; callouts בצד שרת).

## 6. אימות אזרחים — הזדהות לאומית  [MIX] — שלב הבא
- **[ORG]** רישום כ-Service Provider מול מערך הדיגיטל (login.gov.il, SAML 2.0/OIDC) — onboarding ממשלתי.
- **[DEV]** Auth Provider/SAML config ל-Experience site; שדה `Identity_Mode__c` (מזוהה/אנונימי/בחירה) על התבנית; מילוי-אוטומטי של שדות פרטים אישיים מ-claims מאומתים; החתמת `Identity_Verified__c` על הפנייה.

## 7. אתר Experience פר-רשות  [MIX]
- **[ORG]** לכל רשות: דומיין/My Domain, מיפוי DNS, Guest user נפרד, מיתוג.
- **[DEV]** תבנית DigitalExperienceBundle לשכפול פר-רשות + הרשאות Guest מינימליות; קישור ה-`formId` הקיים ממשיך לעבוד.

## 8. ניטור, גיבוי, ניהול שינויים  [ORG] + [DEV חלקי]
- **[DEV]** להפעיל Field History Tracking + Setup Audit Trail על אובייקטי הליבה.
- **[ORG]** Event Monitoring/Shield + חיבור ל-GSOC; Transaction Security Policies; גיבוי מובנה (Data+Metadata, מוצפן). ניהול שינויים כבר קיים: git + CI/CD (GitHub Actions → sf CLI), עם דוח כשלי רכיב (`scripts/print_deploy_failures.py`).

## 9. כיסוי בדיקות ≥75%  [DEV] — לפני פרודקשן
מחלקות בדיקה קיימות ורצות ב-CI (`RunSpecifiedTests`). לפני מעבר לפרודקשן: להריץ `RunLocalTests` בסנדבוקס נקי, למדוד כיסוי org-wide, ולהשלים פערים. (הערה: בסנדבוקס הנוכחי יש ~12 בדיקות כושלות מחבילות צד-ג' — יש לבודד/לתקן לפני מדידה כוללת.)

---

### מה שיושם כבר בקוד (עקבי עם ההנחיה)
- אכיפת FLS/CRUD: `WITH USER_MODE` / `as user` בבקרים הפנימיים; guest ב-permset מינימלי.
- callouts בצד שרת בלבד (data.gov.il, Anthropic) — CSP-safe, ללא fetch חוצה-מקור מהדפדפן.
- אין סודות בקוד חדש; מפתח ה-AI לא מוחזר ללקוח.
- ולידציית קלט בצד שרת (`FormValidationService`), ולידציית סוג/תוכן קבצים.
- LWC תואם Strict CSP; טוקני עיצוב + גופן ב-Static Resource.
- ניהול שינויים מגובה git + CI עם הדפסת כשלים.

> מסמך זה הוא תוכנית ביצוע; אינו מחליף את המסמך המחייב (הנחיה 5.35) ואת אישור גורמי האבטחה המוסמכים.
