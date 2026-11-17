const STATUSES = ['Active', 'Inactive', 'Expired', 'Suspended'];
const ENVIRONMENTS = ['Production', 'Staging', 'Development'];

function isNonEmptyString(value, max = 255) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}

function isObjectId(value) {
  return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value.trim());
}

/**
 * Reference fields may hold either an ObjectId (hex string) or a legacy numeric id.
 */
function isRefValue(value) {
  return isObjectId(value) || (typeof value === 'string' && /^\d{1,15}$/.test(value.trim()));
}

function toRefValue(value) {
  const trimmed = String(value).trim();
  return isObjectId(trimmed) ? trimmed : Number(trimmed);
}

function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isFutureDate(value) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function normalizeDomain(value) {
  if (!isNonEmptyString(value, 253)) return null;
  let host = value.trim().toLowerCase();
  if (/^https?:\/\//.test(host)) {
    try {
      host = new URL(host).hostname;
    } catch {
      return null;
    }
  } else {
    host = host.split('/')[0].split(':')[0];
  }
  host = host.replace(/^www\./, '');
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) return null;
  return host;
}

function slugifyDomain(domain) {
  if (typeof domain !== 'string') return '';
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Validates the license payload. Returns { valid, errors, data }.
 */
function validateLicensePayload(body, { partial = false } = {}) {
  const errors = [];
  const data = {};

  const requireField = (field, check) => {
    if (!check()) errors.push(`${field} is required and invalid`);
  };

  const optionalField = (field, check, key = field) => {
    if (body[key] !== undefined) {
      if (!check()) errors.push(`${field} is invalid`);
      else data[key] = typeof body[key] === 'string' ? body[key].trim() : body[key];
    }
  };

  if (!partial || body.name !== undefined) {
    requireField('License name', () => isNonEmptyString(body.name) && (data.name = body.name.trim()) !== undefined);
  }
  if (!partial || body.domain !== undefined) {
    requireField('Domain', () => (data.domain = normalizeDomain(body.domain)) !== null);
  }
  if (!partial || body.product_id !== undefined) {
    requireField('Product name', () => isRefValue(body.product_id) && (data.product_id = toRefValue(body.product_id)) !== undefined);
  }
  if (!partial || body.customer_id !== undefined) {
    requireField('Customer name', () => isRefValue(body.customer_id) && (data.customer_id = toRefValue(body.customer_id)) !== undefined);
  }
  if (!partial || body.project_id !== undefined) {
    requireField('Project name', () => isRefValue(body.project_id) && (data.project_id = toRefValue(body.project_id)) !== undefined);
  }
  if (!partial || body.expiry_date !== undefined) {
    requireField('Expiry date', () => isFutureDate(body.expiry_date) && (data.expiry_date = new Date(body.expiry_date)) !== undefined);
  }
  if (!partial || body.environment !== undefined) {
    requireField('License environment', () => ENVIRONMENTS.includes(body.environment) && (data.environment = body.environment) !== undefined);
  }
  if (!partial || body.status !== undefined) {
    requireField('Status', () => STATUSES.includes(body.status) && (data.status = body.status) !== undefined);
  }

  optionalField('Remarks', (v) => typeof v === 'string' && v.length <= 1000);

  return { valid: errors.length === 0, errors, data };
}

module.exports = { validateLicensePayload, normalizeDomain, slugifyDomain, STATUSES, ENVIRONMENTS };
