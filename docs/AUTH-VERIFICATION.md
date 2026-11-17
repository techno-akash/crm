# Verification report — 17 November 2026

**Current access policy:** the later user request supersedes the original additive-only access boundary. Admin/license pages and license-management APIs now require a staff session. Historical verification results below describe their state at the time; see the final section for the current tests.

Implementation completed within the approved additive integration boundary. The existing API-key license system and original frontend routes retain their previous access rules. New sessions secure the new account pages and new protected endpoints. Existing license screens were not migrated to staff authentication.

## Automated backend checks

`LOG_LEVEL=silent npm test`: **29 passed, 0 failed**, using Node 24.22.3. Tests requiring sockets were run outside the restricted filesystem/network sandbox after automatic approval. Authentication and legacy CRUD regression tests start their own disposable local `mongod`, create fixtures only there, then shut it down and remove its data. Existing license-validation tests use their original mocked aggregation.

Verified:

- Existing license-validation response shape; missing/invalid API keys; invalid keys; absent licenses; expired licenses; matching/mismatching domains; www normalization; referer fallback; suspended licenses; missing-domain rejection.
- Existing license list/search, form options, create, detail, update, CSV export, bulk delete and missing-record response against real disposable MongoDB; API-key authentication still required; health response unchanged.
- Malformed input, NoSQL operator input, invalid JSON, unknown/wrong credentials with identical responses and audit records.
- Staff/customer login separation, protected endpoint type separation, agent versus admin permissions, explicit public response fields, tampered/missing tokens.
- Inactive accounts, ten-failure lockout, lock expiration and successful counter reset.
- Email 2FA without premature session issuance; keyed code hashes; invalid codes; atomic one-use verification; challenge JWT expiry; disabled 2FA rejection; remembered-login preference survives verification.
- AES-GCM encryption/decryption and TOTP verification/replay prevention across login challenges.
- Remember-token rotation, old-row deletion, reuse audit, revocation of every remembered/access session for that identity.
- Generic forgot response, reset-token hash, password strength, one-use reset, immediate access/remember revocation, new-password acceptance and old-password rejection.
- Per-device logout without invalidating another device.
- Origin rejection, credential CORS preflight, production HTTP rejection and Secure cookies.
- Login, reset-request and verification IP rate limits and audit trail.
- Shared logger cookie/set-cookie/referer redaction, UTF-8 bcrypt limits, SMTP synchronous/async failure handling without logging secrets.

The original sandbox test failure was `listen EPERM`; the approved socket-enabled runs passed. This was an environment restriction, not an application failure.

## Browser checks with running frontend/backend

`node scripts/verify-auth-browser.cjs`: **passed** using Playwright Core, installed Google Chrome, a running Vite frontend and Express backend, and a separate disposable MongoDB. Test email delivery is intercepted in memory; no real email is sent. Script requires local `mongod` and Chrome (`CHROME_PATH` can override `/usr/bin/google-chrome`).

Verified:

- Unauthenticated portal redirects to customer login.
- Customer password toggle, remember checkbox, successful login, cross-type redirect, page reload with missing access cookie followed by silent refresh and remember-token rotation, logout.
- Staff login enters the 2FA page with no query token, email-code verification, staff dashboard and redirect away from the customer portal.
- Forgot-password generic confirmation, reset link, inline password-strength error, successful reset and correct login redirect.
- No token keys in localStorage during the checked flow.
- Mobile auth page has no horizontal overflow at 390px width.
- Existing license list and create form render; no browser JavaScript errors in the exercised flows.

An initial browser check found a password input label ambiguity. Explicit accessible labels were added and both subsequent runs passed. A screenshot from verification is available locally at `/tmp/license-auth-mobile.png`.

## Build and static checks

- `npm run build --prefix frontend`: passed (1,607 modules).
- `npm run check`: passed.
- Syntax checks on new route/controller/provisioning scripts: passed.
- `git diff --check`: passed.
- npm root dependency install audit: reported zero vulnerabilities. Existing dependency version ranges are unchanged; new dependencies are listed in the integration guide. Node minimum raised to 20.19 to satisfy the newly added otplib crypto dependency.

## Practical limits

No live production records were created or changed. Real SMTP delivery, external TLS/proxy deployment, operational retention and recovery, and multi-worker rate limiting were not tested. Tests cover the features explicitly listed above; they do not prove that every possible existing interaction is unchanged. XLSX export, every pagination/sort combination and all legacy UI interactions were not exhaustively exercised. Existing license authorization intentionally remains API-key based.

The new `/admin` and `/portal` pages are minimal protected account pages. Account provisioning uses an explicit script; public signup, an account-management UI and TOTP enrollment UI are outside this integration. Secrets and SMTP must be configured before authentication can be used; no `.env` values or default accounts were installed.

For every new file, exact existing-file edits, endpoint examples and deployment steps, see [AUTHENTICATION.md](AUTHENTICATION.md).

## Login design and URL update

The customer form now uses `/authentication/login`, and the admin/staff form uses `/admin/authentication`, following the supplied screenshots. Previous `/login` and `/admin/login` URLs redirect to these forms. Auth redirects and recovery destinations were updated consistently. Backend authentication behavior and endpoint URLs are unchanged. Added `LoginFrame.jsx` and `login.css`, updated `LoginForm.jsx`, and adjusted the browser verification script for the new URLs, labels, header/help action and screenshots.

After the URL/design update, `node scripts/verify-auth-browser.cjs` passed all checked flows again, including the admin URL alias, customer language field, header help dialog, password toggle, both sign-ins, 2FA, refresh, recovery, logout, protected redirects and existing license screens. Frontend production build passed with 1,609 modules; Vite emitted its advisory about the main JavaScript chunk exceeding 500 kB. Desktop previews: `/tmp/license-customer-login-desktop.png`, `/tmp/license-admin-login-desktop.png`; mobile previews: `/tmp/license-auth-mobile.png`, `/tmp/license-admin-login-mobile.png`. Backend code was unchanged in this update, so the earlier 29-test backend result still applies to it.

## Profile menu and logout update

Added `frontend/src/components/ProfileMenu.jsx` and `ProfileMenu.css`, plus `frontend/src/pages/auth/AccountLayout.jsx` and `account.css`. The sidebar card and header avatar in existing `Sidebar.jsx` and `Topbar.jsx` now use the session-aware menu; account landing pages use the same menu in their dashboard layout. The old hardcoded CURRENT_USER constant is no longer rendered as an authenticated identity. Guests see login links. This update does not change legacy license API access rules.

A read-only query of the configured database found **0 staff and 0 customer auth accounts**. Required authentication environment settings are incomplete. The query did not create accounts, collections or passwords. Tests use disposable accounts only.

Browser checks passed for customer and staff profile-menu logout, actual signed-in email display on the legacy sidebar, My Profile dialog, language selection display, keyboard/Escape dismissal, failed logout with visible retry, successful logout, removal of access/remember cookies and denial of protected account pages after logout. Guest account menus show login links and no Logout action. Frontend build passed (1,613 modules); Vite continues to emit its 500 kB chunk-size advisory. `git diff --check` passed. Backend endpoints were unchanged in this update. Screenshot: `/tmp/license-profile-logout.png`.

## Staff-only admin routes and license API (current policy)

The user explicitly requested that admin login lead to `/admin/`, the dashboard sidebar lead to `/admin/licenses`, and unauthenticated visitors have no license access. This supersedes the original instruction to preserve legacy license access rules.

- Staff guard now wraps `/admin/`, `/admin/licenses`, create/edit pages, `/`, and old `/licenses*` aliases. Old license URLs redirect to their protected admin counterparts. All navigation, create/edit/return links and the company-logo link use the new structure.
- Dashboard and licenses use the same sidebar/header layout. Customer accounts cannot open these pages.
- `/api/licenses` uses requireAuth plus staff-type authorization for every endpoint. The browser client sends cookies and no longer sends VITE_API_KEY. Auth middleware provides strict credential CORS, mutation content-type/origin checks and cookie parsing for license requests; the general license API rate limit is retained.
- External `/api/license_validate/get_license_details` continues to use the original API key and response shapes.

`LOG_LEVEL=silent npm test`: **29 passed, 0 failed**. The expanded license regression test verifies unauthenticated/API-key-only rejection, customer rejection on every license endpoint, staff CRUD/options/search/export, and rejection after logout. Original external license-validation tests passed. Browser checks passed for guest root/admin/license rejection, staff login landing at `/admin/`, Client License navigation to `/admin/licenses`, create form, old-route redirects, customer API rejection, logout and recovery flows. Frontend build and `git diff --check` passed. No live accounts or business records were created/modified. A running non-watch backend needs a restart to load the changed middleware.

The actual development backend on port 3000 was confirmed to belong to this project and restarted with the updated middleware. A fresh Chrome session against the running `http://localhost:5173` site verified that `/`, `/admin/` and `/admin/licenses` each redirect to `/admin/authentication`. The live license API currently returns 503 because auth environment configuration is incomplete; it no longer serves license data without authentication. Valid configured sessions were verified separately in the disposable database tests above.
