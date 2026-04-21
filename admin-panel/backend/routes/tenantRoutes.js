const express = require('express');
const router  = express.Router();
const { authenticate }    = require('../middleware/auth');
const tenantController    = require('../controllers/tenantController');

router.use(authenticate);

router.get('/stats',            tenantController.getStats);
router.get('/modules',          tenantController.getModules);
router.get('/',                 tenantController.getAll);
router.get('/:id',              tenantController.getOne);
router.post('/',                tenantController.create);
router.put('/:id',              tenantController.update);
router.delete('/:id',           tenantController.remove);
router.post('/:id/reset-password', tenantController.resetPassword);

module.exports = router;
