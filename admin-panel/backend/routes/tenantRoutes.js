const express = require('express');
const router  = express.Router();
const { authenticate }    = require('../middleware/auth');
const tenantController    = require('../controllers/tenantController');

router.use(authenticate);

router.get('/stats',              tenantController.getStats);
router.get('/modules',            tenantController.getModules);
router.get('/activity',           tenantController.getActivity);
router.get('/revenue',            tenantController.getRevenue);
router.get('/',                   tenantController.getAll);
router.get('/:id',                tenantController.getOne);
router.get('/:id/activity',       tenantController.getTenantActivity);
router.get('/:id/details',        tenantController.getDetails);
router.post('/',                  tenantController.create);
router.put('/:id',                tenantController.update);
router.post('/:id/reset-password',     tenantController.resetPassword);
router.get('/:id/branches',            tenantController.getBranches);
router.post('/:id/branches',           tenantController.createBranch);
router.put('/:id/branches/:branchId',  tenantController.updateBranch);
router.delete('/:id/branches/:branchId', tenantController.deleteBranch);

module.exports = router;
