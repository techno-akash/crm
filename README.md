# Secure License Verification API

Backend-only Node.js, Express, Mongoose, and MongoDB API.

## Setup

```bash
npm install
cp .env.example .env
```

Set the existing secret in `.env`:

```env
MONGO_URI=mongodb://127.0.0.1:27017/license_verification
API_KEY=your-existing-api-key
PORT=3000
NODE_ENV=development
ALLOW_MISSING_DOMAIN=true
```

For compatibility, `MONGODB_URI` and `STATIC_SECRET_KEY` are also accepted, but new deployments should use `MONGO_URI` and `API_KEY`.

Start the server:

```bash
npm start
```

Insert linked sample data:

```bash
npm run seed
```

## Endpoint

```text
GET /api/license_validate/get_license_details?key=ABC123
```

```bash
curl -H "Authorization: Bearer $API_KEY" \
  "http://localhost:3000/api/license_validate/get_license_details?key=ABC123"
```

Successful response:

```json
{
  "key": "ABC123",
  "expiry_date": "2027-11-05",
  "user_name": "Admin",
  "user_email": "admin@example.com",
  "status": "valid",
  "site_url": "cabify.ecommerce.com",
  "domain_slug": "cabify-ecommerce-technocratshorizons-com",
  "payment_status": "active",
  "expiry_status": "active"
}
```

An unknown key returns HTTP 404:

```json
{ "status": "invalid", "error": "License not found" }
```

## Domain enforcement

Licenses are bound to the site that uses them. The API detects the calling site automatically from the `Origin` header (falling back to `Referer`); no request changes are required.

- If the detected hostname does not match the license `domain`, the API returns HTTP 403: `{ "status": "invalid", "error": "License not valid for this domain" }`.
- Hostnames are normalized (lowercase, protocol/`www.`/port/path stripped), so `https://www.example.com/cart` matches a license issued for `https://example.com`.
- Licenses with a `status` other than `active` are rejected with HTTP 403 regardless of the domain.
- When neither header is present (e.g. server-to-server calls), `ALLOW_MISSING_DOMAIN=true` (default) allows the request and logs a warning; set it to `false` to reject such requests strictly.

Note: `Origin`/`Referer` headers are sent automatically by browsers but can be forged by custom HTTP clients, so enforcement is a strong deterrent rather than a cryptographic guarantee.

## Exact MongoDB collections

The models use the migrated CRM collection and field names exactly: `tbllicenses`, `tblclients`, `tblcontacts`, `tblproducts`, and `tblprojects`. Foreign keys are ObjectIds and match the referenced document `_id`; the legacy fields `id` and `userid` are stored with the same ObjectId value as `_id` where specified.

The controller uses an aggregation with `$lookup` for client, product, project, and primary contact, then formats `expiry_date` as `YYYY-MM-DD` and compares it with today. Expired licenses return HTTP 200 with `status: "expired"` and `expiry_status: "expired"`, matching the requested legacy behavior. In production, missing `Origin`/`Referer` headers are rejected by default; set `ALLOW_MISSING_DOMAIN=true` only when a trusted server-to-server integration cannot send either header.

## Security

Authorization runs before database access. The API key is loaded from environment variables and compared using a timing-safe comparison. Helmet, rate limiting, request-size limits, MongoDB operator sanitization, compression, redacted structured logging, strict key validation, and safe production error responses are enabled. Do not commit `.env`; use HTTPS in production.
