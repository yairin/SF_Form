# הזדהות לאומית (National Authentication) — SAML 2.0 integration

Integration of the citizen-facing forms with Israel's national authentication
service (**מערכת ההזדהות הלאומית**, `login.gov.il`) per the מערך הדיגיטל
technical annex *"נספח טכני ללקוחות — חיבור למערכת ההזדהות הלאומית, SAML 2, v2.4"*.

## Decisions (agreed for this implementation)

| Topic | Decision |
|---|---|
| Environment first | **Test** — `st.login.gov.il` (closed env; requires IP whitelist + registration). Production only after PT + connection approval. |
| Onboarding status | **Not started** — this repo ships the code backbone + this runbook; onboarding with מערך הדיגיטל is the critical path (see checklist). |
| Identity model | **Identity for the form only** — after national auth the form pre-fills and **locks** the ID number + name; we do not build a broader identified portal. |
| Scope | **Per template** — only forms whose `Identity_Mode__c` is `Identified` (mandatory) or `Applicant_Choice` (offered) use national auth. |

> **Important architectural note.** The annex (§ "אופן מימוש חיבור SAML") states a
> self-developed SP is **not allowed** — the SP must be an off-the-shelf SAML
> product. Salesforce's built-in SAML SSO satisfies this. Consequently, even the
> "identity for the form only" model is delivered by letting Salesforce's SAML SP
> establish the session; the minimal, compliant vehicle is a lightweight
> **External Identity** user provisioned Just-In-Time and keyed by the national ID
> (`FederationIdentifier`). The form then reads that verified identity and locks
> the identity fields. There is no supported way to obtain the assertion on a pure
> guest page without a custom SP, which the annex forbids.

## IdP endpoints (from the annex)

| Purpose | Test (st) | Production |
|---|---|---|
| SSO login | `https://st.login.gov.il/nidp/saml2/sso` | `https://login.gov.il/nidp/saml2/sso` |
| IdP metadata | `https://st.login.gov.il/nidp/saml2/metadata` | `https://login.gov.il/nidp/saml2/metadata` |
| Single Logout (SLO) | `https://st.login.gov.il/nidp/saml2/slo` | `https://login.gov.il/nidp/saml2/slo` |
| Simple logout redirect | `https://st.gov.il/mw/logout.html?forwardURL=<url>` | `https://gov.il/mw/logout.html?forwardURL=<url>` |

These are centralized in `classes/NationalAuthConfig.cls` (switch env there).

## Attributes returned in the assertion

`NameID` (format **unspecified**) = the 9-digit national ID. Attributes:

| XML field | Meaning | Required | Notes |
|---|---|---|---|
| `IDNum` | מספר זהות | yes | 9 digits — also the NameID |
| `HebName` | שם פרטי (עברית) | yes | ≤255 UTF-8 |
| `HebLastName` | שם משפחה (עברית) | yes | ≤255 UTF-8 |
| `LOA` | רמת הבטחת אימות (רב״א) | yes | one digit 3–4 |
| `PreferredLang` | שפה מועדפת | no | Hebrew/Arabic/Russian/English |
| `Mobile` | טלפון נייד | no | may be empty |
| `Mail` | דוא"ל | no | may be empty |
| `CardType`,`Cert` | כרטיס חכם | (smart-card only) | Comsign/PersonalID/Tamuz/IsraelID + base64 cert |

> **Cloud caveat:** some clouds (AWS/GCP) can't decrypt the SAML assertion; in that
> case **only the national ID** is delivered, no other attributes. Salesforce
> supports an assertion-decryption certificate, so full attributes are expected —
> but the code treats every attribute except `IDNum` as optional.

Salesforce SAML→field mapping is implemented in `classes/NationalAuthJitHandler.cls`
(when Phase 2 lands): `IDNum→FederationIdentifier`, `HebName→FirstName`,
`HebLastName→LastName`, `Mail→Email`, `Mobile→MobilePhone`.

## Certificates & crypto (mandatory)

- Signing: **RSA-SHA256**. Encryption: **AES256**.
- SP certificate must be issued by a recognized **CA** or be a **Tamuz** cert from
  מערך הדיגיטל. **Self-signed is allowed in the test env only — never in production.**
- The AuthnRequest and LogoutRequest must be **signed with the SP private key**.
- SP cert validity used must not exceed 3 years. The IdP certs rotate ~every 5
  years (current validity 02/2028) — the SP owner must refresh them and re-send
  updated metadata to מערך הדיגיטל.

## Salesforce Setup steps (SP side) — done in Setup, not deployable

1. **My Domain** deployed (required for SAML).
2. **Certificate & Key Management** → create the SP signing/decryption cert
   (self-signed for test; CA/Tamuz for prod).
3. **Single Sign-On Settings** → *New from Metadata* using the IdP metadata URL, then set:
   - Issuer / **Entity Id** = the SP entityID (should contain the site URL, e.g.
     `https://<mydomain>.my.site.com/vforcesite`).
   - Identity Location = **Subject / NameID**, SAML Identity Type = **FederationId**,
     NameID format = **unspecified**.
   - Request Signing Certificate = the SP cert; Request Signature Method = **RSA-SHA256**.
   - Assertion Decryption Certificate = the SP cert (AES256).
   - Enable **Single Logout**, SLO URL = the IdP `.../slo`, binding HTTP-POST/Redirect.
   - Just-in-Time provisioning = **enabled**, handler = `NationalAuthJitHandler`.
4. **Experience Cloud site** → Administration → Login & Registration → add the
   SAML SSO setting as a login option; set the "login with national auth" button.
5. **Generate SP metadata** (Salesforce provides it on the SSO setting page / the
   `.../login?so=<orgId>` endpoint) and send it to מערך הדיגיטל to establish Trust.
   Ensure the metadata has: `entityID`, `NameIDFormat=unspecified`, signing +
   encryption `KeyDescriptor` (base64 X509), `AssertionConsumerService`
   (HTTP-POST, isDefault), `SingleLogoutService`. Remove any `validUntil` tag.

## Mandatory client-side features (annex § 5)

- [x] Styled "מעבר להזדהות לאומית" button (per the גוב design spec) — `lwc/nationalAuthButton` (Phase 2).
- [x] Explanation to the user before redirect + open in a separate window/popup.
- [x] Logout button → SLO / `mw/logout.html?forwardURL=`.
- [x] Session renewal for the identified user (session managed by the SP/Experience site).
- National-auth session length is 20 min (IdP-controlled; not changeable per app).

## Input-validation regex on incoming fields (annex § "בדיקות קלט")

The service already validates incoming fields; the form mirrors the important ones
(national ID check digit, Hebrew name `[א-ת\s\'\"\-\(\)]{2,25}`, phone). These live
in `FormValidationService` / `dynamicForm` and are reused for the locked fields.

## Onboarding checklist with מערך הדיגיטל (critical path — start now)

1. [ ] Submit the "בקשת חיבור" onboarding form to מערך הדיגיטל; get an integration contact.
2. [ ] Provide the SP **entityID** and **ACS URL(s)** (Experience site) for registration.
3. [ ] Request **IP whitelisting** for the test env (`st.login.gov.il` is closed).
4. [ ] Obtain/issue the SP **certificate** (self-signed for test; CA/Tamuz for prod).
5. [ ] Exchange **metadata** (send SP metadata, import IdP metadata).
6. [ ] Register test identities (test env accepts fictitious identities).
7. [ ] Run integration tests; capture with **SAML Tracer** if debugging.
8. [ ] For production: fill the "סיום פיתוח ומוכנות לייצור" form, attach **PT** results,
       pass compatibility checks (§5.1–5.5), get connection approval, coordinate go-live.

## Code in this repo

- `classes/NationalAuthConfig.cls` — endpoints/entityID/env + min LOA (single switch point).
- `classes/NationalIdentityController.cls` — `getIdentity()` returns the current
  Experience user's verified national ID + name (guest-safe: returns not-identified).
- `classes/NationalAuthJitHandler.cls` *(Phase 2)* — `Auth.SamlJitHandler` mapping.
- `lwc/dynamicForm` *(Phase 2)* — pre-fill + lock identity fields when identified;
  gate the form / show the login button when `Identity_Mode__c = Identified` and guest.
- `lwc/nationalAuthButton` *(Phase 2)* — styled login/logout button + explanation.
