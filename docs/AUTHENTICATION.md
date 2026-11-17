# Isolated staff and customer authentication

Staff authentication now protects the admin dashboard, license management pages and `/api/licenses` endpoints, following the user's explicit request to secure the existing license system. Staff login lands at `/admin/`; the side menu opens `/admin/licenses`, with create/edit under that prefix. Unauthenticated requests to admin pages redirect to `/admin/authentication`. Customer sessions cannot access admin pages or license APIs. The old `/` and `/licenses*` URLs are protected aliases; they no longer render license content without a staff session.

License API calls use httpOnly cookies and no longer send a browser API key. The separate external `/api/license_validate/get_license_details` endpoint retains its existing API-key authentication and response formats. No existing business-data collections were migrated or altered by implementation.

## Configure and start

1. Use Node.js 20.19+ (tested with 24.22.3). Install root and frontend dependencies (`npm install`, then `npm install --prefix frontend`).
2. Append the auth settings from `.env.example` to your local environment. Existing settings are retained; VITE_API_KEY is no longer used by the browser license client. Generate JWT_SECRET with `openssl rand -hex 32` and a separate AUTH_2FA_ENCRYPTION_KEY with another `openssl rand -hex 32`. Never commit the output. Configure real SMTP credentials and SMTP_FROM. Placeholders cannot deliver email.
3. Set FRONTEND_URL to the exact browser origin, e.g. `http://localhost:5173`. AUTH_CORS_ORIGINS adds exact trusted origins; wildcards are rejected. The new module returns 503 if secrets/configuration are incomplete or MongoDB is disconnected; the separate external license-validation endpoint remains available under its existing configuration.
4. Run `npm start` and `npm run dev --prefix frontend`. Vite proxies `/api` to port 3000. Optional frontend `VITE_AUTH_API_BASE_URL` defaults to `/api`; use a same-site URL. No existing frontend environment variables were changed.
5. Provision accounts explicitly with the operator command below. There is no public registration or privilege-change endpoint. Existing clients/contacts are never automatically converted into accounts.

### Provisioning

Pipe a password from a secret manager through stdin (first line). For TOTP, provide an already-enrolled base32 secret of at least 160 bits on the second line. Avoid shell history, command arguments and plaintext temporary files for secrets.

```sh
# Replace secret-manager-read with your own secure secret provider.
secret-manager-read staff-password | node scripts/auth-provision.js staff admin@example.com admin email
secret-manager-read customer-password | node scripts/auth-provision.js customer customer@example.com
# TOTP input: password newline base32-secret newline
secret-manager-read staff-totp-account | node scripts/auth-provision.js staff agent@example.com agent totp
```

The script hashes passwords at bcrypt cost 12, normalizes emails, encrypts TOTP secrets with AES-256-GCM and refuses duplicate emails. Staff roles are `admin` and `agent`. Account administration/enrollment UI is outside this additive integration.

### Production

Use NODE_ENV=production, an HTTPS FRONTEND_URL, trusted HTTPS origins and a TLS reverse proxy. New auth endpoints reject HTTP with 426. Set the existing TRUST_PROXY=true only when a trusted proxy is the only path to the service and overwrites forwarded headers. Serve the frontend with `npm run build --prefix frontend`; the existing production static hosting remains in place. If a different host serves the frontend, set its Referrer-Policy to `no-referrer` as well. SameSite=Strict requires a same-site deployment; arbitrary cross-site frontend/API deployment is unsupported.

Rate limits use the express-rate-limit in-memory store: deploy one Node process, or configure a shared store/edge rate limiter before deploying multiple workers. HTTPS, SMTP delivery, proxy configuration and deployment hardening require verification in your environment. This implementation is not a claim of absolute security.

## Login form URLs and design

- Customer form: `http://localhost:5173/authentication/login`
- Admin/staff form: `http://localhost:5173/admin/authentication`
- Previous `/login` and `/admin/login` URLs redirect to the corresponding forms.

Protected-route redirects, logout, 2FA restart and password-recovery destinations use these canonical URLs. Customer and staff authentication stay separate. The customer form matches the supplied reference with a company header, English language selection, centered login card, remember checkbox and recovery link. Its Knowledge Base action opens a login-help dialog. The admin/staff form uses the supplied centered-logo layout and places password recovery beside the password label. Both use the existing logo, dark submit button, keyboard focus states and responsive sizing. Password visibility toggles are retained. English is the currently supported language.

## Requests and responses

All POST requests require `Content-Type: application/json`. All requests use cookies (`credentials: 'include'`, equivalent to Axios `withCredentials: true`). No access, refresh or challenge token belongs in localStorage. Responses use `Cache-Control: no-store`. Unknown auth routes return 404. Bad input returns 400 `{ "message": "Invalid request", "errors": [{ "field": "email", "message": "..." }] }`; oversized payloads return 413; disallowed origins return 403; unavailable configuration/database returns 503. Rate-limited requests return 429 and Retry-After.

| Method/path | Request | Success |
| --- | --- | --- |
| POST `/api/admin/auth/login` | `{ "email": "admin@example.com", "password": "StrongPass123", "rememberMe": true }` | 200 `{ "user": { "id": "...", "email": "admin@example.com", "type": "staff", "role": "admin" } }`; sets cookies, or 2FA response below |
| POST `/api/auth/customer/login` | Same login fields | 200 `{ "user": { "id": "...", "email": "customer@example.com", "type": "customer", "role": "customer", "profile": { "name": "..." } } }` |
| POST `/api/admin/auth/verify-2fa` | `{ "tempToken": "...", "code": "123456" }` | 200 staff user response and session cookies |
| GET `/api/auth/me` | No query/body; access cookie | 200 `{ "user": { "id": "...", "email": "...", "type": "staff", "role": "agent" } }` |
| GET `/api/auth/refresh` | No query/body; remember cookie | 200 user response; rotates remember cookie and issues fresh access cookie |
| POST `/api/auth/forgot-password` | `{ "email": "customer@example.com", "type": "customer" }` | Always 200 for a valid request under normal service operation: `{ "message": "If the email exists, a reset link has been sent" }` |
| POST `/api/auth/reset-password` | `{ "type": "customer", "userId": "24-hex-id", "token": "64-hex-token", "password": "NewStrongPass123" }` | 200 `{ "message": "Password reset. Please sign in." }` |
| POST `/api/auth/logout` | `{}` | 200 `{ "message": "Signed out" }`; clears cookies and current device sessions |
| GET `/api/admin/auth/dashboard` | Access cookie | 200 staff user; staff admin or agent only |
| GET `/api/admin/auth/admin-only` | Access cookie | 200 user; staff role admin only |
| GET `/api/auth/customer/portal` | Access cookie | 200 customer user; customers only |

`type` is always `staff` or `customer`, including reset requests. Staff and customer endpoints query separate collections. A staff account cannot authenticate at the customer login endpoint and vice versa, even if the same email exists in both collections. Wrong-type protected requests return 403 `{ "message": "Access denied" }`. Invalid/missing/revoked/expired access sessions return 401 `{ "message": "Authentication required" }`.

Login: unknown account/wrong password returns 401 `{ "message": "Invalid email or password" }`. After ten consecutive failed password/2FA attempts the account locks for 15 minutes; locked requests return 429 `Account temporarily locked. Try again later.` Correct credentials for an inactive account return 403 `Account is inactive. Contact administrator.` Login IP limits are shared across both types: 5/min. Forgot/reset limits are shared at 3/min; verify-2fa is 5/min; refresh is 10/min.

Staff 2FA login returns `{ "twoFactorRequired": true, "tempToken": "..." }`, with no new full session. The five-minute JWT includes only id/purpose plus standard JWT claims (including a random jti); its audience differs from access tokens. Email codes last one hour, but verification also requires the unexpired five-minute challenge. Starting a new login replaces the previous challenge. Challenges/codes are consumed atomically and cannot be reused. Invalid, expired or replayed codes return 401 `Invalid or expired verification code`. TOTP accepts a 30-second tolerance and stores the last accepted time step to reject replay across challenges.

Reset email links use `/reset-password?type=...&userId=...&token=...`. The page captures credentials in memory and removes them from the URL/history after loading. Reset passwords require 8–72 characters, at most 72 UTF-8 bytes, uppercase, lowercase and a number. Reset links expire in one hour and are atomically consumed. Invalid, inactive, expired or reused links return 400 `Invalid or expired reset link`. Reset immediately revokes all existing sessions/remember tokens using a version increment in the same database update.

### Curl examples

Use shell variables supplied by a secret manager for credentials; keep the cookie jar private.

```sh
BASE=http://localhost:3000
# Login input JSON supplied via stdin by your secret manager:
secret-manager-read customer-login-json | curl -sS -c /tmp/private-auth.cookies \
  -H 'Content-Type: application/json' --data-binary @- "$BASE/api/auth/customer/login"
curl -sS -b /tmp/private-auth.cookies "$BASE/api/auth/me"
curl -sS -b /tmp/private-auth.cookies -c /tmp/private-auth.cookies "$BASE/api/auth/refresh"
curl -sS -b /tmp/private-auth.cookies -c /tmp/private-auth.cookies \
  -H 'Content-Type: application/json' -d '{}' "$BASE/api/auth/logout"
curl -sS -H 'Content-Type: application/json' \
  -d '{"email":"customer@example.com","type":"customer"}' "$BASE/api/auth/forgot-password"
# For other endpoints, POST the corresponding JSON from the table using --data-binary @-.
```

Create the cookie jar with restrictive permissions (`umask 077`) and delete it afterward. Production cookies require HTTPS.

## Storage and security details

New collections only: `staff`, `customers`, `auth_tokens`, `auth_logs`, `auth_sessions`, `auth_token_uses`. Existing `tbl*` collections and model schemas are unchanged. Ensure the auth collection names are unused before enabling against an existing deployment. Provisioning creates only explicit new auth accounts; tests use disposable local databases.

- Passwords use bcrypt cost 12. Models exclude hashes/secrets/reset tokens from default queries; controllers return explicit public fields only.
- Six-digit codes use HMAC-SHA256 with the separate encryption key; high-entropy remember/reset/challenge tokens use SHA-256 hashes. TOTP secrets use authenticated AES-256-GCM encryption.
- Access cookies (`auth_access`) last one day; remember cookies (`remember_token`) last 60 days, sliding on refresh. Both are httpOnly, SameSite=Strict, Secure in production. One browser cookie pair represents one selected identity at a time.
- `auth_sessions` stores access-token hashes for immediate per-device logout. JWTs also carry sessionVersion; middleware checks active status, current role and sessionVersion on every protected request.
- Refresh atomically claims a consumed-token hash in `auth_token_uses`, deletes the old `auth_tokens` row and creates a fresh row/token. Keeping consumed hashes until their original expiry enables reuse detection without retaining raw tokens. Reuse revokes every session and remember token for that identity and creates an audit warning. Concurrent refreshes for the same cookie are treated as reuse; the React bootstrap shares its initialization to avoid StrictMode double-refresh.
- Token/session collections have TTL indexes and explicit expiry checks; security does not depend on prompt TTL cleanup. Auth logs are retained until an operator applies an appropriate retention policy.
- Auth and license-management routes receive strict credential CORS, JSON-only mutations and Origin/Fetch-Metadata checks; auth routes use Zod validation and specialized limits, while license routes retain their business validation and general request limit. Existing Helmet settings apply. Auth and session-protected license requests bypass the legacy request logger; shared logger redacts cookies, set-cookie and referer, and request URLs redact sensitive token query parameters.
- Mail is dispatched asynchronously through Nodemailer; missing configuration/delivery errors never expose message contents or crash a flow. SMTP failure means the user will need a later retry; there is no durable job queue in this implementation.

## New files

Backend:

- `src/config/auth.js`
- `src/controllers/auth.controller.js`
- `src/middleware/auth.middleware.js`
- `src/validators/auth.validators.js`
- `src/routes/auth.routes.js`
- `src/services/auth.service.js`, `src/services/auth.crypto.js`, `src/services/mailer.js`
- `src/models/auth.model-fields.js`, `src/models/Staff.js`, `src/models/Customer.js`
- `src/models/AuthToken.js`, `src/models/AuthLog.js`, `src/models/AuthSession.js`, `src/models/AuthTokenUse.js`

Frontend:

- `frontend/src/context/AuthContext.jsx`
- `frontend/src/components/ProtectedRoute.jsx`, `frontend/src/components/ProfileMenu.jsx`, `frontend/src/components/ProfileMenu.css`
- `frontend/src/services/authApi.js`
- `frontend/src/pages/auth/AdminLoginPage.jsx`, `CustomerLoginPage.jsx`, `Verify2FAPage.jsx`, `ForgotPasswordPage.jsx`, `ResetPasswordPage.jsx`
- `frontend/src/pages/auth/LoginForm.jsx`, `AuthForm.jsx`, `AccountHomePage.jsx`, `auth.css`, `LoginFrame.jsx`, `login.css`, `AccountLayout.jsx`, `account.css`

Tools/tests/docs:

- `scripts/auth-provision.js`, `scripts/verify-auth-browser.cjs`
- `test/auth.test.js`, `test/auth-security.test.js`
- `docs/AUTHENTICATION.md`, `docs/AUTH-VERIFICATION.md`

## Exact existing-file edits

| Existing file | Reason |
| --- | --- |
| `src/server.js` | Register the auth module before legacy logging/CORS; move license-management registration into its session-protected policy; redact sensitive token query parameters. |
| `src/routes/adminLicenseRoutes.js` | Require an authenticated staff session instead of the shared API key for all license-management endpoints. |
| `frontend/src/api/client.js` | Send session cookies and stop embedding the API key; handle failed downloads as API errors. |
| `frontend/src/pages/LicensesPage.jsx`, `frontend/src/pages/LicenseFormPage.jsx`, `frontend/src/pages/NotFoundPage.jsx` | Point list, create, edit and return links at protected `/admin/licenses` URLs. |
| `frontend/src/components/layout/Layout.jsx` | Point the company-logo link at `/admin/`. |
| `src/utils/logger.js` | Add cookie, set-cookie and referer redaction so new credentials do not leak on legacy requests. |
| `frontend/src/components/layout/Sidebar.jsx` | Use the actual profile dropdown; add Dashboard and link Client License under `/admin/licenses`. |
| `frontend/src/components/layout/Topbar.jsx` | Use the actual account dropdown and recognize the new admin license URL prefix. |
| `frontend/src/App.jsx` | Add auth provider and protected admin/license routes; old license URLs redirect through the staff guard. |
| `package.json` | Add bcryptjs, cookie-parser, jsonwebtoken, nodemailer, otplib and zod; add Playwright Core as a development dependency for browser verification; raise the Node minimum from 20.0 to 20.19 for otplib’s crypto dependency. |
| `package-lock.json` | Lock the added dependencies. No existing direct dependency version ranges were changed. |
| `.env.example` | Append new auth placeholders; preserve existing variables. |

All changes to existing files are listed above. Business controllers, schemas, environment secrets and live database documents were preserved; authentication changes to license routes are explicitly authorized by the later user request. Frontend build output is regenerated by verification and is ignored by its existing gitignore.

Security configuration reference: [Express production security guidance](https://expressjs.com/advanced/best-practice-security/).

## Profile dropdown and logout

Click the sidebar profile card or header avatar to open the account menu. Signed-in users see My Profile, Language (English), and Logout. My Profile shows public account details in a dialog. Logout calls the existing POST `/api/auth/logout`, removes the current access session and device remember token, clears both cookies, clears the React session, and redirects staff to `/admin/authentication` or customers to `/authentication/login`. A failed logout leaves the account signed in and displays a retryable error. The menu supports keyboard navigation, Escape, focus dismissal and outside clicks. The menu is available on the protected license screens, admin dashboard and customer account layout. Guests see login links rather than a fictitious logged-in identity. Timesheets and profile editing are not implemented by this authentication module.

A read-only database check on 17 November 2026 found zero staff and zero customer authentication accounts, and incomplete auth environment settings. The old CURRENT_USER constant is placeholder UI data, not a database account. No account or password was created by that check; use the provisioning instructions above for an initial account.

## Protected license management

All existing `/api/licenses` endpoints (list, detail, options, CSV export, create, update and bulk delete) now require a current staff access cookie. API-key-only requests return 401 and customer sessions return 403. Business response shapes remain unchanged. The external license-validation API is still API-key based. If the backend is already running with `npm start`, restart it after applying this update; Vite updates the frontend during development.
