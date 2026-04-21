const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/sectionsController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', authorize('Admin', 'Manager'), ctrl.create);
router.put('/:id', authorize('Admin', 'Manager'), ctrl.update);
router.delete('/:id', authorize('Admin'), ctrl.remove);

module.exports = router;
