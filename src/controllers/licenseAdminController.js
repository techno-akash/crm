const licenseAdminService = require('../services/licenseAdminService');
const { validateLicensePayload } = require('../validators/licenseValidator');

const CSV_HEADERS = ['ID', 'License Name', 'Product Name', 'Project Name', 'Customer Name', 'Domain', 'License Key', 'Expiry Date', 'Status'];

function escapeCsv(value) {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv(rows) {
  const lines = [CSV_HEADERS.join(',')];
  for (const row of rows) {
    lines.push([
      row.id ?? row._id,
      row.name,
      row.productName,
      row.projectName,
      row.customerName,
      row.domain,
      row.maskedKey || licenseAdminService.maskLicenseKey(row.licenkey),
      row.expiry_date ? new Date(row.expiry_date).toISOString().slice(0, 10) : '',
      row.status
    ].map(escapeCsv).join(','));
  }
  return lines.join('\n');
}

async function listLicenses(req, res, next) {
  try {
    const result = await licenseAdminService.listLicenses(req.query);
    return res.json({ status: 'success', ...result });
  } catch (error) {
    return next(error);
  }
}

async function exportLicenses(req, res, next) {
  try {
    const rows = await licenseAdminService.exportLicenses(req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="licenses-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(toCsv(rows));
  } catch (error) {
    return next(error);
  }
}

async function getLicense(req, res, next) {
  try {
    const license = await licenseAdminService.getLicenseById(req.params.id);
    if (!license) return res.status(404).json({ status: 'error', message: 'License not found' });
    return res.json({ status: 'success', data: license });
  } catch (error) {
    return next(error);
  }
}

async function createLicense(req, res, next) {
  try {
    const { valid, errors, data } = validateLicensePayload(req.body);
    if (!valid) return res.status(422).json({ status: 'error', message: 'Validation failed', errors });
    const license = await licenseAdminService.createLicense(data);
    return res.status(201).json({ status: 'success', data: { id: license.id, _id: license._id, licenkey_masked: licenseAdminService.maskLicenseKey(license.licenkey) } });
  } catch (error) {
    return next(error);
  }
}

async function updateLicense(req, res, next) {
  try {
    const { valid, errors, data } = validateLicensePayload(req.body, { partial: true });
    if (!valid) return res.status(422).json({ status: 'error', message: 'Validation failed', errors });
    const license = await licenseAdminService.updateLicense(req.params.id, data);
    if (!license) return res.status(404).json({ status: 'error', message: 'License not found' });
    return res.json({ status: 'success', data: { id: license.id, _id: license._id } });
  } catch (error) {
    return next(error);
  }
}

async function deleteLicenses(req, res, next) {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (ids.length === 0) return res.status(422).json({ status: 'error', message: 'No licenses selected' });
    if (ids.length > 100) return res.status(422).json({ status: 'error', message: 'Cannot delete more than 100 licenses at once' });
    const deleted = await licenseAdminService.deleteLicenses(ids);
    return res.json({ status: 'success', data: { deleted } });
  } catch (error) {
    return next(error);
  }
}

async function getFormOptions(req, res, next) {
  try {
    const options = await licenseAdminService.getFormOptions();
    return res.json({ status: 'success', data: options });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listLicenses, exportLicenses, getLicense, createLicense, updateLicense, deleteLicenses, getFormOptions };
