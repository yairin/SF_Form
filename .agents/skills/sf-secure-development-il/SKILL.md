---
name: sf-secure-development-il
description: "Israeli government secure-development requirements for Salesforce, distilled from directive יה\"ב 5.35 (\"שימוש מאובטח בפלטפורמת Salesforce\", v2.1, מערך הדיגיטל הלאומי). MUST be applied to EVERY Salesforce development task in this project — Apex, LWC, metadata, permissions, Experience Cloud, integrations, CI/CD. TRIGGER on any change to force-app metadata, Apex classes/triggers, LWC, permission sets/profiles, sharing/OWD, Auth Providers, Connected Apps, Named Credentials, or CI deploy config. Enforces data residency (Israel), OWD-Private + least privilege, FLS/CRUD enforcement, Shield encryption of PII, national-identity (הזדהות לאומית) SSO + MFA, session/CSP hardening, API & secrets hygiene, guest-site hardening, file malware scanning, secure backups, change management, and monitoring."
metadata:
  version: "1.0"
  source: "יה\"ב הנחיה 5.35 — שימוש מאובטח בפלטפורמת Salesforce, גרסה 2.1 (12.11.2024)"
  authority: "היחידה להגנת הסייבר בממשלה (יה\"ב) / מערך הדיגיטל הלאומי"
---

# פיתוח מאובטח ב-Salesforce — יישום הנחיית יה"ב 5.35

הנחיה מחייבת לכל משרדי הממשלה ויחידות הסמך (וברשויות מקומיות המתממשקות למערך הדיגיטל).
סקיל זה מתרגם את ההנחיה לדרישות **ברות-אכיפה בפיתוח**. חל **תמיד** בכל עבודת פיתוח SF בפרויקט זה.

לכל פריט מסומן מי אחראי:
- **[DEV]** — נאכף/נבנה בקוד או במטא-דאטה שאנחנו כותבים. חובה ליישם/לוודא בכל PR.
- **[ORG]** — הגדרת ארגון/ממשל שאינה בקוד (אחריות מנהל האבטחה/הארגון). לתעד ולהזכיר, לא לחסום פיתוח.

> כלל-על: **פירמידה הפוכה** — קודם סוגרים הכל (Deny by default), ופותחים גישה מינימלית לפי צורך עסקי מוכח.

---

## 1. מיקום נתונים ותאימות (§4.1.3, §9.1.26)
- **[ORG]** השירות מוקם ב-**אזור הישראלי בלבד** (חדר שרתים של SF בישראל). תאימות לחוק הגנת הפרטיות ו-GDPR.
- **[DEV]** אין לכתוב אינטגרציות שמעבירות PII מחוץ לגבולות הגזרה ללא אישור; קריאות חוץ (callouts) דרך Named Credential בלבד.

## 2. מודל הרשאות ושיתוף (§7, §17)
- **[DEV]** **OWD = Private לכל האובייקטים** (פנימי וחיצוני: `External Organization-Wide Defaults = Private`). מתן צפייה נוספת רק ב-**Sharing Rules / Roles**.
- **[DEV]** אכיפת **FLS/CRUD** בכל Apex: `WITH USER_MODE` ב-SOQL ו-`as user` ב-DML (או `Security.stripInaccessible`). בקוד guest שרץ system-mode — לצמצם permset ולא לחשוף נתונים רגישים.
- **[DEV]** להשתמש ב-**Validation Rules + FLS + Page Layout** כדי למנוע עריכה/שינוי של שדות מוצפנים/רגישים (§17.3).
- **[ORG]** שינוי Sharing/OWD ב-**Two-Control** (שני מורשים בלתי-תלויים) (§17.4); מטריצת **הפרדת תפקידים (SoD)** (§17.5).
- **[ORG]** **High-Assurance session** לפעולות רגישות (Reports/Dashboards, Manage Users/Sharing/Encryption Keys/Connected Apps/Data Export...) (§17.6).

## 3. סיווג והצפנת מידע — Shield (§9.1.6–9.1.19, §10, §11)
- **[DEV]** לסווג כל שדה: **PII/PHI/CHI** (למשל תעודת זהות, מידע רפואי) ולסמן ל-**הצפנה/מיסוך**.
- **[DEV]** **Shield Platform Encryption** לשדות רגישים (ת"ז ודומיו). לבחור סוג הצפנה: **Deterministic** (כשצריך חיפוש/מיון) מול **Probabilistic** (חזק יותר). לשים לב להשלכות על דוחות/SOQL.
- **[DEV]** **Data Mask** לכל סביבת Sandbox — אין להחזיק PII אמת ב-Sandbox (חל על Custom Fields/Objects, Chatter, קבצים).
- **[ORG]** מפתחות קריפטוגרפיים ב-**HSM**, החלפה עתית, מפתח ייעודי לכל סביבה, שני גיבויים בלתי-תלויים, גישה ל-Key Management רק עם MFA/OTP (§11).
- **[ORG]** רישוי חובה: **Shield** + **Data Mask** (+ Privacy Center / Security Center לפי צורך) (§10.1).

## 4. אימות והזדהות (§14)
- **[DEV/ORG]** אימות משתמשים ב-**MFA/2FA** בלבד, או דרך **מערכת ההזדהות הלאומית** (login.gov.il, SAML 2.0 / OIDC) עבור אזרחים.
- **[DEV]** להטמיע **Login Flows / Conditional Access**: IP allowlist (IPv4+IPv6), `Enforce login IP ranges on every request`, Login Hours.
- **[DEV]** **אין להשתמש ב-Self-Service portals** (§14.7). לאזרחים — Experience Cloud עם הזדהות לאומית.
- **[ORG]** מדיניות סיסמאות מורשת מ-IdP/IAM מרכזי; חשבונות חירום (Breaking Glass) מצומצמים עם MFA.

## 5. הגנת Session ו-Web hardening (§15) — **[DEV]** ברמת Org/Experience
הגדרות חובה (Session Settings / Security):
- `Session Timeout = 15m (external) / ≤2h (internal)`; `Lock sessions to IP = Yes`; `Lock sessions to domain = Yes`.
- HTTPS: `Force relogin after Login-As-User = Yes`, `Require HttpOnly = Yes`, `Use POST for cross-domain = Yes`, `Enforce login IP ranges = Yes`.
- Caching: `autocomplete on login = No`, `user switching = No`.
- **Clickjack protection = Yes**; **Enable Stricter Content Security Policy (CSP) = Yes**; **XSS protection = Yes**; **Content Sniffing protection = Yes**; `Hide URL from other sites = Yes`; `Warn before external redirect = Yes`.
- **[DEV-LWC]** לכתוב קוד תואם **Strict CSP**: אין inline event handlers מסוכנים, אין `eval`, אין משאבים חיצוניים (CDN) — הכל self-contained/Static Resources (עקבי עם CSP של אתר ה-Experience).

## 6. פיתוח מאובטח — Apex & LWC (§18)
- **[DEV]** למלא **Secure Coding Guidelines** של SF (Client-side + Server-side).
- **Apex:**
  - SOQL/SOSL עם **bind variables** בלבד (מניעת SOQL Injection); אם בונים דינמית — `String.escapeSingleQuotes`.
  - `with sharing` כברירת מחדל; `without sharing` רק כשמוצדק (נתיב guest) ומתועד.
  - אכיפת FLS/CRUD (סעיף 2).
  - **אין סודות בקוד** (API keys/secrets) → **Named Credential** או **Protected Custom Setting/Custom Metadata**. לעולם לא בשדה גלוי/בקוד/בגיט.
  - טיפול שגיאות שלא מדליף מידע פנימי; ולידציית קלט בכל entry point (`@AuraEnabled`, guest).
- **LWC:**
  - Escape/serialize של פלט; אין `lwc:dom="manual"` עם HTML לא-מהימן; אין `innerHTML` עם קלט משתמש.
  - קלט משתמש נחשב לא-מהימן — לאמת בצד השרת (לא לסמוך על ולידציית לקוח בלבד).
  - תואם Strict CSP (סעיף 5).

## 7. אבטחת API ו-Secrets (§12, §22)
- **[DEV]** **Connected App / Connector ייעודי** לכל אינטגרציה, עם **הרשאות מינימליות**.
- **[ORG]** גישת API דרך **API Gateway** עם input/schema validation ו-rate limiting; החלפת `Consumer Key/Secret` כל **90 יום**; IP allowlist; `TLS 1.2+`.
- **[DEV]** לכבות `Allow use of setPassword() API for self-resets`. אין קריאות API מ-Sandbox לפרודקשן.
- **[DEV-MuleSoft]** (אם בשימוש): Anypoint Security Policies (IP allowlist, DoS, HTTP limits, WAF), **Tokenization** למידע רגיש, **Secrets Manager** (לא בקוד), Secrets ייחודיים לכל סביבה, TLS 1.2+, הצפנת Secure Configuration Properties.

## 8. הגנת מידע וקבצים (§16)
- **[DEV/ORG]** SF **אינו סורק נוזקות** בקבצים — חובה **סריקת אנטי-וירוס בצד שלישי** לפני קבלת קובץ (בטופס הציבורי: לשלב שלב סריקה/הסגר לפני שיוך ל-`ContentVersion`, או סריקה אסינכרונית + חסימת גישה עד לאישור).
- **[DEV]** ולידציית סוג/גודל קובץ (כבר קיים), ומחיקה עתית של קבצים זמניים/נסתרים.

## 9. הפרדת סביבות וניהול שינויים (§19) — **[DEV/CI]**
- **[DEV]** פיתוח/בדיקות ב-**Sandbox** עם **Data Mask** (בלי PII אמת).
- **[CI]** **CI/CD מלא עם git**: תיעוד שינויים ב-repo, deploy מגובה (העבודה כאן דרך GitHub Actions → sf CLI), אישורי שינוי מתועדים. אין שינויים ישירים בפרודקשן; **אין שימוש לא-מבוקר ב-Hotfix**.
- **[DEV]** **כיסוי בדיקות Apex ≥ 75%** (org-wide) לפני deploy לפרודקשן, עם assertions משמעותיים; כל טריגר מכוסה. (בפרויקט: לשמור את רשימת ה-`--tests` ב-workflows מסונכרנת עם מחלקות חדשות.)

## 10. גיבוי (§20) — **[ORG]**
גיבוי/שחזור סדור לכל סביבה (Data **וגם** Metadata), מוצפן כברירת מחדל, יעד מאושר ע"י ועדת הענן, גישת API לגיבוי ב-IP allowlist. עדיף פתרון גיבוי מובנה של SF.

## 11. ניטור, לוגים וביקורת (§21) — **[ORG]** עם תמיכת **[DEV]**
- **[DEV]** להפעיל: **Field History Tracking**, **Setup Audit Trail** (מובנה), ולסמן שדות רגישים למעקב.
- **[ORG]** **Event Monitoring / Shield** + חיבור ל-**GSOC** הממשלתי; Transaction Security Policies לאירועים חריגים (דלף מידע, Shadow IT, הענקת Role/Permission חזק); ניטור `Login as any user`; הרצת **Security Health Check** ו-**Optimizer** תדיר.

---

## רשימת תיוג מהירה ל-PR (מה לבדוק בכל שינוי קוד)
1. SOQL עם bind variables? DML/SOQL עם `WITH USER_MODE`/`as user`? ✅
2. אין סוד בקוד/בגיט? מפתחות ב-Named Credential/Protected Setting? ✅
3. `with sharing` (או `without sharing` מתועד לנתיב guest בלבד)? ✅
4. שדות PII חדשים → סווגו + סומנו להצפנת Shield + FLS? ✅
5. קלט משתמש/guest מאומת בשרת, לא רק בלקוח? ✅
6. LWC תואם Strict CSP (בלי CDN/inline מסוכן)? ✅
7. קבצים מהציבור → מסלול סריקת נוזקות? ✅
8. OWD Private נשמר; לא נפתחה גישה רחבה מדי? ✅
9. כיסוי בדיקות ≥75% + assertions? רשימת `--tests` ב-CI עודכנה? ✅
10. הרשאות חדשות = מינימום הכרחי (least privilege)? ✅

## פערים ידועים בפרויקט הנוכחי (לטיפול)
- מפתח ה-API של מנוע ה-AI צריך לעבור ל-**Named Credential** (לא בשדה/הגדרה גלויה).
- להוסיף **סריקת נוזקות** לקבצים שמועלים בטופס הציבורי (כרגע ולידציית סוג/תוכן בלבד).
- לוודא **OWD Private + Sharing Rules לפי רשות** (רב-רשותיות) — סעיף בידוד.
- **Shield Platform Encryption** לשדה תעודת זהות ולשדות אישיים רגישים.
- הזדהות אזרחים דרך **מערכת ההזדהות הלאומית** (הכנת תשתית SSO).

> מקור: הנחיית יה"ב 5.35, גרסה 2.1. סקיל זה הוא תרגום מעשי לפיתוח; אינו מחליף את המסמך המחייב ואת אישור גורמי האבטחה המוסמכים.
