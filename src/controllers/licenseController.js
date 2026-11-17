const License = require('../models/License');
const config = require('../config');
const logger = require('../utils/logger');
const { extractRequestHostname, isDomainAllowed } = require('../utils/domain');

function toDateOnly(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

async function getLicenseDetails(req, res) {
  try {
    const key = req.query.key;
    if (typeof key !== 'string' || !key || !/^[a-zA-Z0-9]+$/.test(key)) {
      return res.status(400).json({ status: 'invalid', error: 'Invalid license key format' });
    }

    const [license] = await License.aggregate([
      { $match: { licenkey: key } },
      { $lookup: { from: 'tblclients', localField: 'customer_id', foreignField: 'userid', as: 'customer' } },
      { $lookup: { from: 'tblproducts', localField: 'product_id', foreignField: 'id', as: 'product' } },
      { $lookup: { from: 'tblprojects', localField: 'project_id', foreignField: 'id', as: 'project' } },
      { $lookup: {
        from: 'tblcontacts',
        let: { custId: '$customer_id' },
        pipeline: [{ $match: { $expr: { $and: [
          { $eq: ['$userid', '$$custId'] },
          { $eq: ['$is_primary', 1] }
        ] } } }],
        as: 'primaryContact'
      } },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$primaryContact', preserveNullAndEmptyArrays: true } },
      { $limit: 1 }
    ]);

    if (!license) return res.status(404).json({ status: 'invalid', error: 'License not found' });

    if (license.status && license.status !== 'active') {
      return res.status(403).json({ status: 'invalid', error: `License is ${license.status}` });
    }

    const requestHostname = extractRequestHostname(req);
    if (requestHostname) {
      if (!isDomainAllowed(license.domain, requestHostname)) {
        return res.status(403).json({ status: 'invalid', error: 'License not valid for this domain' });
      }
    } else if (!config.allowMissingDomain) {
      return res.status(403).json({ status: 'invalid', error: 'License not valid for this domain' });
    } else {
      logger.warn('Domain headers missing; verified without domain check');
    }

    const expiryDate = toDateOnly(license.expiry_date);
    if (!expiryDate) return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    const today = new Date().toISOString().slice(0, 10);
    const expiryStatus = expiryDate >= today ? 'active' : 'expired';

    return res.status(200).json({
      key: license.licenkey,
      expiry_date: expiryDate,
      user_name: license.customer?.company ?? 'NA',
      user_email: license.primaryContact?.email ?? 'NA',
      status: expiryStatus === 'active' ? 'valid' : 'expired',
      site_url: license.domain,
      domain_slug: license.domain_slug,
      payment_status: 'active',
      expiry_status: expiryStatus
    });
  } catch (error) {
    logger.error({ err: error }, 'License lookup failed');
    const payload = { status: 'error', message: 'Internal Server Error' };
    if (config.nodeEnv === 'development') payload.error = error.message;
    return res.status(500).json(payload);
  }
}

module.exports = { getLicenseDetails };
