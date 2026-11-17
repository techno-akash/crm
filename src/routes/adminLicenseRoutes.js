const express = require('express');
const auth = require('../middleware/auth');
const controller = require('../controllers/licenseAdminController');

const router = express.Router();

router.use(auth);

router.get('/', controller.listLicenses);
router.get('/export', controller.exportLicenses);
router.get('/options', controller.getFormOptions);
router.get('/:id', controller.getLicense);
router.post('/', controller.createLicense);
router.put('/:id', controller.updateLicense);
router.post('/bulk-delete', controller.deleteLicenses);

module.exports = router;
