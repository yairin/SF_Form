# הזדהות לאומית (National Authentication) — SAML 2.0 integration

Integration of the citizen-facing forms with Israel's national authentication
service (**מערכת ההזדהות הלאומית**, `login.gov.il`) per the מערך הדיגיטל technical
annex *"נספח טכני ללקוחות — חיבור למערכת ההזדהות הלאומית, SAML 2, v2.4"*.

## Decisions (agreed)

| Topic | Decision |
|---|---|
| Environment first | **Test** — `st.login.gov.il` (closed; requires IP whitelist + registration). Production only after PT + approval. |
| Onboarding status | **Not started** — this repo ships the code backbone + this runbook so onboarding with מערך הדיגיטל (the critical path) can start now. |
| **Citizen licenses** | **None, and none planned.** The citizen must **not** become a Salesforce user. This rules out Salesforce acting as the SAML SP (SAML login always consumes a licensed user). |
| **Double authentication** | **Not acceptable** — a single sign-in only. |
| Identity model | The form stays a **guest (anonymous)** page. National auth happens at an **off-the-shelf SP gateway in front of the form**; the verified national ID is handed to the guest form via a short-lived **signed token**, which the form uses to pre-fill + **lock** the ID/name fields. |
| Scope | **Per template** — only forms whose `Identity_Mode__c` is `Identified` (mandatory) or `Applicant_Choice` (offered). |

## Why not Salesforce-as-SP (the earlier assumption — now ruled out)

Salesforce's built-in SAML SSO is an off-the-shelf SP, **but it authenticates a
user INTO the org** — i.e. it needs a licensed community/External-Identity user
per citizen. With **no citizen licenses (and none planned)** that path is off the
table. A pure-Salesforce national-auth login for guests is therefore **not
achievable**, and the annex forbids a self-developed SP. The resolution below keeps
the form anonymous, uses a compliant off-the-shelf SP as a **gateway** (not
Salesforce), and authenticates the citizen **once**.

## Chosen architecture (license-free, single sign-in)

```
                (1) open form
  Citizen ───────────────────────────────►  Salesforce guest form (Experience)
     │                                              │  needs identity? (Identity_Mode)
     │  (2) redirect to gateway  ◄──────────────────┘
     ▼
  Off-the-shelf SAML SP GATEWAY  ──(3) SAML AuthnRequest──►  login.gov.il (IdP)
  (מערך-הדיגיטל-hosted, or the                              ◄──(4) SAML assertion──
   authority's identity broker)
     │  (5) mint short-lived SIGNED token (JWT) with IDNum/HebName/HebLastName/LOA
     ▼
  (6) redirect back to the guest form  ?t=<signed token>
     │
     ▼
  Salesforce guest form ──(7) verify token signature (Apex, public key) ──► pre-fill + LOCK id/name
```

- **The SP is the gateway, not Salesforce.** The gateway is a standard SAML product
  (so the annex's "no self-developed SP" is satisfied). Options for the gateway:
  1. **מערך הדיגיטל hosted SP** — if מערך הדיגיטל fronts the service ("שירות המתארח
     במערך הדיגיטל"), their components act as SP and route back to a non-identified
     URL. Ask your integration contact whether our Salesforce site can be fronted this way.
  2. **The authority's existing identity gateway / broker** (e.g. an API gateway,
     reverse proxy, or IdP broker already certified as a SAML SP).
  3. A thin **off-the-shelf SAML SP** stood up by the authority (e.g. Keycloak /
     SimpleSAMLphp / Shibboleth) acting only as this gateway.
- **Single auth:** the citizen authenticates once — at the gateway. The form never
  logs anyone in.
- **Token hand-off (step 5–7):** the gateway mints a **short-lived, signed** token
  (JWT signed with the gateway's private key, or HMAC with a shared secret) carrying
  the verified `IDNum`, `HebName`, `HebLastName`, `LOA`, and a one-time `nonce`
  bound to our audience. Salesforce **verifies the signature** (public key / secret
  configured in a protected custom setting) — this is ordinary trusted-token
  verification, **not** SAML protocol handling, so it does not count as a
  self-developed SP.

> If the chosen gateway can instead pass identity server-to-server (POST the verified
> attributes to a guest Apex REST endpoint keyed by a nonce, form reads by nonce),
> that avoids putting the token in the URL. Either variant is supported by the same
> Salesforce-side verifier.

## IdP endpoints (from the annex) — used BY THE GATEWAY

| Purpose | Test (st) | Production |
|---|---|---|
| SSO login | `https://st.login.gov.il/nidp/saml2/sso` | `https://login.gov.il/nidp/saml2/sso` |
| IdP metadata | `https://st.login.gov.il/nidp/saml2/metadata` | `https://login.gov.il/nidp/saml2/metadata` |
| Single Logout (SLO) | `https://st.login.gov.il/nidp/saml2/slo` | `https://login.gov.il/nidp/saml2/slo` |
| Simple logout redirect | `https://st.gov.il/mw/logout.html?forwardURL=<url>` | `https://gov.il/mw/logout.html?forwardURL=<url>` |

Mirrored in `classes/NationalAuthConfig.cls`.

## Attributes returned in the assertion (gateway receives; relays to us)

`NameID` (format **unspecified**) = the 9-digit national ID. Attributes: `IDNum`
(required, = NameID), `HebName`, `HebLastName`, `LOA` (3–4), `PreferredLang`,
`Mobile`, `Mail`; smart-card adds `CardType`,`Cert`. Every field except `IDNum` is
optional (some clouds relay only the ID). The gateway forwards the subset we request
(minimum: `IDNum`, `HebName`, `HebLastName`, `LOA`).

## Certificates & crypto (mandatory — at the GATEWAY)

Signing **RSA-SHA256**, encryption **AES256**; SP cert from a recognized CA or a
Tamuz cert; self-signed allowed **in test only**. AuthnRequest/LogoutRequest signed
by the SP (gateway) private key. These are the **gateway's** responsibility. On the
Salesforce side we only hold the **gateway's public key / shared secret** used to
verify the hand-off token.

## Salesforce side — what this repo builds (license-free, guest-safe)

- `classes/NationalAuthConfig.cls` — IdP endpoints + min LOA (reference/config).
- `classes/NationalIdentityController.cls` — returns the verified identity to the
  form. **Backbone today** reads it from the running user (harmless no-op for guests);
  **Phase 2** adds `verifyToken(token)` that validates the gateway's signed token and
  returns `{idNumber, firstName, lastName, loa}` for a guest session — no login, no user.
- `lwc/dynamicForm` *(Phase 2)* — when `Identity_Mode__c=Identified`, gate the form
  behind a "כניסה עם הזדהות לאומית" button that redirects to the gateway; on return,
  verify the token and **pre-fill + lock** the ID/first/last fields; show the identity
  notice. `Applicant_Choice` offers it but allows anonymous.
- `lwc/nationalAuthButton` *(Phase 2)* — the styled button (per the gov design spec),
  the user explanation, open-in-new-window, and a logout link to `mw/logout.html`.
- **No** JIT/Registration handler, **no** External Identity users, **no** Salesforce
  SAML SSO setting — deliberately, because there are no citizen licenses.

## Mandatory client-side features (annex §5) — mapped to our side

- [ ] Styled "מעבר להזדהות לאומית" button + user explanation + open in a separate window.
- [ ] Logout link → `mw/logout.html?forwardURL=<non-identified page>`.
- [ ] The identified session is short (form-scoped): the token is short-lived; no long session to renew.
- National-auth session length is 20 min (IdP-controlled).

## Onboarding checklist with מערך הדיגיטל (critical path — start now)

1. [ ] Submit the "בקשת חיבור" onboarding form (draft: `docs/national-auth/onboarding-request.md`).
2. [ ] **Confirm the gateway** (decision needed): מערך-הדיגיטל-hosted SP, the authority's
       existing broker, or a stand-up off-the-shelf SP. This determines the SP metadata + token format.
3. [ ] Provide the gateway's SP **entityID** and **ACS URL(s)** for registration.
4. [ ] Request **IP whitelisting** for the test env (`st.login.gov.il` is closed) — the
       gateway's public IP(s).
5. [ ] Obtain/issue the gateway **SP certificate** (self-signed for test; CA/Tamuz for prod).
6. [ ] Exchange **metadata** (gateway SP ↔ IdP).
7. [ ] Agree the **hand-off token** contract (JWT public key / shared secret, claims, TTL, audience).
8. [ ] Register test identities (test env accepts fictitious identities); test end-to-end.
9. [ ] Production: "סיום פיתוח ומוכנות לייצור" form + **PT** results + compatibility checks
       (§5.1–5.5) + connection approval + go-live coordination.
