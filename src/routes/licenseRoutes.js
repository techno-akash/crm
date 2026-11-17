const express = require('express');
const auth = require('../middleware/auth');
const { getLicenseDetails } = require('../controllers/licenseController');

const router = express.Router();
router.get('/get_license_details', auth, getLicenseDetails);

module.exports = router;
