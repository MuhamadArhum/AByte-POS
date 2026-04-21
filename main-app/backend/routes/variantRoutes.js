const express = require('express');
const router = express.Router();
const variantController = require('../controllers/variantController');
const { authenticate, authorize } = require('../middleware/auth');

// ==================== Variant Types Routes ====================
// Get all variant types (public for POS)
router.get('/types', authenticate, variantController.getVariantTypes);

// Create variant type (admin/manager only)
router.post('/types', authenticate, authorize('Admin', 'Manager'), variantController.createVariantType);

// ==================== Variant Values Routes ====================
// Get all values for a variant type (public for POS)
router.get('/types/:variant_type_id/values', authenticate, variantController.getVariantValues);

// Create variant value (admin/manager only)
router.post('/values', authenticate, authorize('Admin', 'Manager'), variantController.createVariantValue);

// ==================== Product Variants Routes ====================
// Get all variants for a product (public for POS)
router.get('/product/:product_id', authenticate, variantController.getProductVariants);

// Get single variant by ID (public for POS)
router.get('/:variant_id', authenticate, variantController.getVariantById);

// Create product variant (admin/manager only)
router.post('/', authenticate, authorize('Admin', 'Manager'), variantController.createProductVariant);

// Update product variant (admin/manager only)
router.put('/:variant_id', authenticate, authorize('Admin', 'Manager'), variantController.updateProductVariant);

// Delete product variant (admin/manager only)
router.delete('/:variant_id', authenticate, authorize('Admin', 'Manager'), variantController.deleteProductVariant);

// Adjust variant stock (admin/manager only)
router.post('/:variant_id/stock/adjust', authenticate, authorize('Admin', 'Manager'), variantController.adjustVariantStock);

module.exports = router;
