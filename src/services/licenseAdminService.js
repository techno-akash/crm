const crypto = require('node:crypto');
const mongoose = require('mongoose');
const License = require('../models/License');
const Client = require('../models/Client');
const Contact = require('../models/Contact');
const Product = require('../models/Product');
const Project = require('../models/Project');
const logger = require('../utils/logger');
const { slugifyDomain } = require('../validators/licenseValidator');

const LICENSE_KEY_LENGTH = 18;
const MASK_KEY_VISIBLE = 4;

function generateLicenseKey() {
  return crypto.randomBytes(LICENSE_KEY_LENGTH / 2).toString('hex').toUpperCase();
}

function maskLicenseKey(key) {
  if (typeof key !== 'string' || key.length <= MASK_KEY_VISIBLE * 2) return '**********';
  return `${key.slice(0, MASK_KEY_VISIBLE)}${'*'.repeat(10)}${key.slice(-MASK_KEY_VISIBLE)}`;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || value === 'true' || value === 1 || value === '1';
}

function parsePagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  let perPage = Number.parseInt(query.per_page, 10);
  if (!Number.isInteger(perPage) || perPage < 1) perPage = 25;
  if (perPage > 100) perPage = 100;
  return { page, perPage, skip: (page - 1) * perPage, limit: perPage };
}

const SORTABLE_FIELDS = {
  id: 'numericId',
  name: 'name',
  product: 'productName',
  project: 'projectName',
  customer: 'customerName',
  domain: 'domain',
  expiry_date: 'expiry_date',
  status: 'status',
  created: 'createdAt'
};

function buildSort(query) {
  const field = SORTABLE_FIELDS[query.sort_by] || 'numericId';
  const direction = query.sort_dir === 'asc' ? 1 : -1;
  return { [field]: direction, _id: direction };
}

function buildSearchMatch(search) {
  if (typeof search !== 'string' || !search.trim()) return null;
  const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');
  return {
    $or: [
      { name: regex },
      { domain: regex },
      { licenkey: regex },
      { status: regex },
      { productName: regex },
      { projectName: regex },
      { customerName: regex }
    ]
  };
}

function buildStatusMatch(status) {
  if (typeof status !== 'string' || !status.trim()) return null;
  return { status: { $regex: `^${status.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } };
}

const LOOKUP_PIPELINE = [
  {
    $lookup: {
      from: 'tblproducts',
      localField: 'product_id',
      foreignField: 'id',
      as: 'product'
    }
  },
  {
    $lookup: {
      from: 'tblprojects',
      localField: 'project_id',
      foreignField: 'id',
      as: 'project'
    }
  },
  {
    $lookup: {
      from: 'tblclients',
      localField: 'customer_id',
      foreignField: 'userid',
      as: 'customer'
    }
  },
  {
    $lookup: {
      from: 'tblcontacts',
      let: { custId: '$customer_id' },
      pipeline: [
        { $match: { $expr: { $and: [{ $eq: ['$userid', '$$custId'] }, { $eq: ['$is_primary', 1] }] } } },
        { $limit: 1 }
      ],
      as: 'primaryContact'
    }
  },
  {
    $addFields: {
      productName: { $arrayElemAt: ['$product.name', 0] },
      projectName: { $arrayElemAt: ['$project.name', 0] },
      customerName: { $arrayElemAt: ['$customer.company', 0] },
      customerEmail: { $arrayElemAt: ['$primaryContact.email', 0] },
      numericId: { $ifNull: ['$id', '$_id'] }
    }
  }
];

function maskedKeyExpression() {
  const key = { $ifNull: ['$licenkey', ''] };
  return {
    $cond: [
      { $gt: [{ $strLenCP: key }, MASK_KEY_VISIBLE * 2] },
      {
        $concat: [
          { $substrCP: [key, 0, MASK_KEY_VISIBLE] },
          '*'.repeat(10),
          { $substrCP: [key, { $subtract: [{ $strLenCP: key }, MASK_KEY_VISIBLE] }, MASK_KEY_VISIBLE] }
        ]
      },
      '**********'
    ]
  };
}

function projectListFields() {
  return {
    $project: {
      _id: 1,
      id: '$numericId',
      name: 1,
      productName: 1,
      projectName: 1,
      customerName: 1,
      customerEmail: 1,
      domain: 1,
      maskedKey: maskedKeyExpression(),
      expiry_date: 1,
      status: 1,
      environment: 1,
      createdAt: 1
    }
  };
}

async function listLicenses(query) {
  const { page, perPage, skip, limit } = parsePagination(query);
  const match = { $match: { $and: [] } };
  const searchMatch = buildSearchMatch(query.search);
  const statusMatch = buildStatusMatch(query.status);
  if (searchMatch) match.$match.$and.push(searchMatch);
  if (statusMatch) match.$match.$and.push(statusMatch);

  const pipeline = [match, ...LOOKUP_PIPELINE];
  if (match.$match.$and.length === 0) pipeline.shift();

  const [result] = await License.aggregate([
    ...pipeline,
    {
      $facet: {
        rows: [
          { $sort: buildSort(query) },
          { $skip: skip },
          { $limit: limit },
          projectListFields()
        ],
        total: [{ $count: 'count' }]
      }
    }
  ]);

  const total = result?.total?.[0]?.count || 0;
  return {
    data: result?.rows || [],
    meta: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.max(1, Math.ceil(total / perPage))
    }
  };
}

async function exportLicenses(query) {
  const match = { $match: { $and: [] } };
  const searchMatch = buildSearchMatch(query.search);
  const statusMatch = buildStatusMatch(query.status);
  if (searchMatch) match.$match.$and.push(searchMatch);
  if (statusMatch) match.$match.$and.push(statusMatch);

  const pipeline = [match, ...LOOKUP_PIPELINE];
  if (match.$match.$and.length === 0) pipeline.shift();

  return License.aggregate([
    ...pipeline,
    { $sort: buildSort(query) },
    projectListFields(),
    { $limit: 5000 }
  ]);
}

async function getLicenseById(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  const [license] = await License.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(id) } },
    ...LOOKUP_PIPELINE,
    {
      $project: {
        _id: 1,
        id: '$numericId',
        name: 1,
        product_id: 1,
        project_id: 1,
        customer_id: 1,
        productName: 1,
        projectName: 1,
        customerName: 1,
        customerEmail: 1,
        domain: 1,
        licenkey: 1,
        expiry_date: 1,
        status: 1,
        environment: 1,
        remarks: 1,
        createdAt: 1
      }
    }
  ]);
  return license || null;
}

async function nextLicenseId() {
  const [last] = await License.aggregate([
    { $match: { id: { $type: ['int', 'long', 'double', 'decimal'] } } },
    { $sort: { id: -1 } },
    { $limit: 1 },
    { $project: { id: 1 } }
  ]);
  const maxNumeric = typeof last?.id === 'number' ? last.id : 0;
  if (maxNumeric > 0) return maxNumeric + 1;
  return new mongoose.Types.ObjectId();
}

async function createLicense(payload) {
  const licenkey = generateLicenseKey();
  const domainSlug = slugifyDomain(payload.domain);
  const numericId = await nextLicenseId();
  const _id = new mongoose.Types.ObjectId();

  const license = await License.create({
    _id,
    id: numericId,
    name: payload.name,
    product_id: payload.product_id,
    project_id: payload.project_id,
    customer_id: payload.customer_id,
    licenkey,
    expiry_date: payload.expiry_date,
    status: payload.status.toLowerCase(),
    environment: payload.environment,
    remarks: payload.remarks,
    domain: payload.domain,
    domain_slug: domainSlug
  });

  logger.info({ licenseId: license._id.toString(), domain: license.domain }, 'License created');
  return license;
}

async function updateLicense(id, payload) {
  if (!mongoose.isValidObjectId(id)) return null;
  const license = await License.findById(id);
  if (!license) return null;

  Object.assign(license, payload, {
    status: payload.status ? payload.status.toLowerCase() : license.status,
    domain_slug: payload.domain ? slugifyDomain(payload.domain) : license.domain_slug
  });
  await license.save();
  logger.info({ licenseId: id }, 'License updated');
  return license;
}

async function deleteLicenses(ids) {
  const objectIds = ids.filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id));
  if (objectIds.length === 0) return 0;
  const result = await License.deleteMany({ _id: { $in: objectIds } });
  logger.info({ deleted: result.deletedCount }, 'Licenses deleted');
  return result.deletedCount;
}

async function getFormOptions() {
  const [products, projects, clients] = await Promise.all([
    Product.aggregate([{ $sort: { name: 1 } }, { $project: { _id: 1, id: 1, name: 1 } }]),
    Project.aggregate([{ $sort: { name: 1 } }, { $project: { _id: 1, id: 1, name: 1 } }]),
    Client.aggregate([{ $sort: { company: 1 } }, { $project: { _id: 1, userid: 1, company: 1 } }])
  ]);
  return { products, projects, clients };
}

module.exports = {
  listLicenses,
  exportLicenses,
  getLicenseById,
  createLicense,
  updateLicense,
  deleteLicenses,
  getFormOptions,
  maskLicenseKey,
  parseBoolean,
  parsePagination
};
