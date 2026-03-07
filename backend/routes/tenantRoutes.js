const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const tenantController = require('../controllers/tenantController');

// All tenant routes: must be logged in AND be Admin
router.use(authenticate);
router.use(authorize('Admin'));

router.get('/', tenantController.getAll);
router.post('/', tenantController.create);
router.put('/:id', tenantController.update);
router.delete('/:id', tenantController.remove);
router.post('/:id/reset-password', tenantController.resetAdminPassword);

module.exports = router;
