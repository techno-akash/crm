# Authentication schema review — 17 November 2026

This is an analysis of the user's latest four-collection schema, the supplied PHP table screenshots, the original task, project documentation and the current implementation. No account or database record was created or modified during this review.

## Conclusion

The implementation is **not an exact match** for the latest schema. The initial task specified `isActive`, a nested customer `profile`, and did not impose a four-auth-collection maximum. The implementation added two auxiliary authentication collections for immediate per-device session revocation and remember-token reuse detection. The latest schema requires a field/role/logging alignment and consolidation of that security state into the four permitted authentication collections.

## Observed database state (read-only)

- `staff`: 0 records; `customers`: 0 records.
- `tblstaff`: absent from collection-name listing; count query returned zero.
- All six current authentication collections exist: staff, customers, auth_tokens, auth_logs, auth_sessions, auth_token_uses.
- `tblclients`: 17 records; all `_id` values are ObjectIds. Sixteen `userid` values are integers and one is an ObjectId.
- `tblcontacts`: 3 records; all `_id` values are ObjectIds. Two `userid` values are integers and one is an ObjectId.
- Account secrets/password hashes were not read. The previous check found required auth environment settings incomplete.

The live data contains mixed legacy ID types despite the original README's ObjectId-oriented description. A numeric legacy userid must never be blindly cast to an ObjectId. Resolve legacy contact.userid to client.userid with its actual type, then store client._id as the new customerId.

## Differences

| Area | Latest requested schema | Current implementation |
| --- | --- | --- |
| Auth collections | Exactly four | Six, including auth_sessions and auth_token_uses |
| Active flag | active | isActive |
| Staff role | admin / staff | admin / agent |
| Names | firstname, lastname on both users | Missing; customer profile.name is nested |
| Customer relationship | customerId, isPrimary | Missing; company duplicated as profile.company string |
| Customer phone/verification | phonenumber, emailVerifiedAt | profile.phone; verification date missing |
| Password change date | lastPasswordChange | Missing |
| Auth token indexes | userId indexed; unique userId + tokenHash | Global unique tokenHash; userId + userType lookup index |
| Logs | email indexed, email + createdAt index, unknown type | userId + createdAt index; staff/customer types only |
| Log reasons | Separate invalid_password/email_not_found/twofa_failed/password_reset_success | invalid_credentials, invalid_2fa, password_reset_completed and additional security events |
| OTP hashes | SHA-256/bcrypt only | Keyed HMAC-SHA256 |

Already aligned: separate staff/customer authentication lookup; bcrypt cost 12 for new passwords; sensitive fields excluded by default; staff-only 2FA; AES-GCM-encrypted TOTP secrets; one-hour email-code/reset expiration; hashed high-entropy tokens; ten-failure/15-minute lockout; timestamps on both account models; remember expiry and TTL indexes; explicit public API responses.

## PHP-to-Mongo mapping

| PHP source | Mongo authentication destination |
| --- | --- |
| tblstaff.email/password/firstname/lastname/active | staff.email/password/firstname/lastname/active |
| tblstaff.admin | staff.role: admin when admin=1, otherwise staff |
| tblstaff.role (numeric CRM permission-role ID) | Not equivalent to admin/staff; preserve separately only if CRM role migration is later required |
| tblstaff.two_factor_auth_enabled | staff.twoFactorEnabled |
| tblstaff.google_auth_secret | staff.twoFactorSecret, encrypted before storage |
| tblstaff.two_factor_auth_code/requested | New hashed code and explicit expiresAt; do not blindly copy old active codes |
| tblstaff.last_ip/last_login/last_password_change/datecreated | lastIp/lastLogin/lastPasswordChange/createdAt |
| tblcontacts | Source of customer login/contact identity; not the company record |
| tblcontacts.userid | Resolve company through tblclients.userid, then set customers.customerId = tblclients._id |
| tblcontacts.is_primary/phonenumber/email_verified_at | customers.isPrimary/phonenumber/emailVerifiedAt |
| tblclients | Existing company profile data, accessed through the existing Client model |
| tbluser_auto_login | Replaced functionally by hashed remember-token records in auth_tokens; never import raw legacy keys |

There is no CustomerProfile model in the repository. The appropriate existing reference target is `Client` (collection `tblclients`), using its ObjectId `_id`. This does not require a fifth auth collection or changes to tblclients/tblcontacts. Existing contacts remain separate until an explicit import is requested; they are not currently customer login accounts.

## Proposed four-collection alignment

1. Apply the user's new account field names and staff role enum, and update every auth query/provisioning/UI projection consistently. Track lastPasswordChange during provisioning/reset. Keep existing business collections unchanged.
2. Keep exactly staff, customers, auth_tokens and auth_logs as authentication collections. Consolidate active access sessions and consumed remember-token hashes into auth_tokens, using additional metadata such as tokenKind (access/remember), status (active/consumed), consumedAt and sessionVersion. Retain user sessionVersion and hidden challenge/replay fields required by the current security controls.
3. Access-token rows expire after one day; remember/consumed remember rows retain the original 60-day expiry. Consumed hashes must survive rotation until original expiry to detect reuse. Do not delete that evidence immediately.
4. Keep the global unique tokenHash safeguard and add the requested userId/compound lookup indexes. Adapt middleware, logout, rotation, reset and tests before retiring the two auxiliary collections. Do not drop any collection without separately checking its contents and migration needs.
5. Add the requested log fields/indexes and normalize the requested reason names. Preserve extra events for rate limiting, token reuse and session refresh. Return generic credential errors to the browser while distinguishing causes in the audit trail. Application writes remain append-only; database-level append-only permissions are a separate deployment configuration.
6. Use a compliant OTP hash implementation (e.g. bcrypt) if the new rule excludes HMAC-SHA256. Never store or return plaintext OTPs. Do not rehash a stored legacy password hash as if it were a password; any legacy hash upgrade needs the actual password after successful verification, or a reset.

This preserves immediate logout and token-reuse defenses within the four-collection limit. It requires security metadata in addition to the user's listed minimum fields; simply deleting the two auxiliary models would break those defenses.

## Information needed for account creation

Admin email, firstname and lastname. Generate a random temporary password, hash it at cost 12 and return the temporary credential once. Configure missing auth secrets/frontend URL without overwriting existing environment values. No default or guessed personal account has been provisioned.
