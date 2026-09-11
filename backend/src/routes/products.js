import express from 'express';
import productService from '../services/product.service.js';
import emailService from '../services/email.service.js';
import { verifyToken, requireRoles, requirePermission } from '../middleware/auth.js';
import { productSchema, searchSchema } from '../validators/product.validator.js';
import { HTTP_STATUS } from '../utils/constants.js';
import logger from '../utils/logger.js';
import { supabase } from '../config/database.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// 🔓 PUBLIC ROUTES - NO AUTH REQUIRED
// ═══════════════════════════════════════════════════════════════

/**
 * @route   GET /api/v1/products/public-test
 * @desc    Public test route - NO AUTH
 * @access  Public
 */
router.get('/public-test', async (req, res) => {
    try {
        console.log('🔍🔍🔍 PUBLIC TEST ROUTE CALLED 🔍🔍🔍');
        
        const { data, error } = await supabase
            .from('product_categories')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('❌❌❌ SUPABASE ERROR ❌❌❌');
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            
            return res.status(200).json({
                success: false,
                error: {
                    code: error.code,
                    message: error.message,
                    details: error.details
                }
            });
        }

        console.log(`✅✅✅ SUCCESS! Found ${data?.length || 0} categories ✅✅✅`);
        return res.status(200).json({
            success: true,
            count: data?.length || 0,
            data: data || []
        });
    } catch (error) {
        console.error('🔥🔥🔥 CATCH ERROR 🔥🔥🔥');
        console.error('Error:', error);
        return res.status(200).json({
            success: false,
            error: {
                message: error.message,
                stack: error.stack
            }
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// 🔒 PROTECTED ROUTES - AUTH REQUIRED
// ═══════════════════════════════════════════════════════════════

/**
 * @route   GET /api/v1/products/get-categories
 * @desc    Get all categories (FIXED - new path)
 * @access  Private
 */
router.get('/get-categories', verifyToken, async (req, res) => {
    try {
        console.log('📂📂📂 GET-CATEGORIES ROUTE CALLED 📂📂📂');
        console.log('📂 User ID:', req.user?.id);
        console.log('📂 User Role:', req.user?.role);
        
        const { data, error } = await supabase
            .from('product_categories')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('📂 Supabase error:', error);
            return res.status(200).json({
                success: false,
                error: {
                    message: error.message,
                    code: error.code,
                    details: error.details
                }
            });
        }

        console.log(`📂 Found ${data?.length || 0} categories`);
        
        return res.status(200).json({
            success: true,
            count: data?.length || 0,
            data: data || []
        });
    } catch (error) {
        console.error('📂 Categories error:', error);
        return res.status(200).json({
            success: false,
            error: {
                message: error.message,
                stack: error.stack
            }
        });
    }
});

/**
 * @route   GET /api/v1/products
 * @desc    Get all products with inventory
 * @access  Private
 */
router.get('/', verifyToken, async (req, res, next) => {
    try {
        const filters = {
            category_id: req.query.category_id,
            is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
            min_price: req.query.min_price ? parseFloat(req.query.min_price) : undefined,
            max_price: req.query.max_price ? parseFloat(req.query.max_price) : undefined
        };

        const products = await productService.getAllProducts(filters);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        logger.error(`GET /products error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/products/search
 * @desc    Search products
 * @access  Private
 */
router.get('/search', verifyToken, async (req, res, next) => {
    try {
        const { error, value } = searchSchema.validate(req.query);
        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Validation error',
                    details: error.details.map(d => d.message)
                }
            });
        }

        const filters = {
            category_id: req.query.category_id,
            is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined
        };

        const products = await productService.searchProducts(value.q, filters);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        logger.error(`GET /products/search error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/products/low-stock
 * @desc    Get low stock products
 * @access  Private (Manager+)
 */
router.get('/low-stock', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        const threshold = req.query.threshold ? parseInt(req.query.threshold) : 5;
        const products = await productService.getLowStockProducts(threshold);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        logger.error(`GET /products/low-stock error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/products/sku/:sku
 * @desc    Get product by SKU
 * @access  Private
 */
router.get('/sku/:sku', verifyToken, async (req, res, next) => {
    try {
        const product = await productService.getProductBySku(req.params.sku);
        
        if (!product) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: {
                    message: 'Product not found'
                }
            });
        }
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: product
        });
    } catch (error) {
        logger.error(`GET /products/sku/:sku error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/products/category/:categoryId
 * @desc    Get products by category
 * @access  Private
 */
router.get('/get-categories', verifyToken, async (req, res) => {
    try {
        const products = await productService.getProductsByCategory(req.params.categoryId);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        logger.error(`GET /products/category/:categoryId error: ${error.message}`);
        next(error);
    }
});
/**
 * @route   POST /api/v1/products/categories
 * @desc    Create a single new category
 * @access  Private (Manager+)
 */
router.post('/categories', verifyToken, requirePermission('stock.manage'), async (req, res) => {
    try {
        const { name, parent_category_id, description } = req.body;
        if (!name || !String(name).trim()) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: { message: 'Category name is required' }
            });
        }

        const category = await productService.createCategory({
            name: String(name).trim(),
            parent_category_id,
            description
        });

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: 'Category created',
            data: category
        });
    } catch (error) {
        logger.error(`POST /products/categories error: ${error.message}`);
        res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            error: { message: error.message }
        });
    }
});

/**
 * @route   POST /api/v1/products/bulk
 * @desc    Bulk create products (up to 40 rows)
 * @access  Private (Manager+)
 */
router.post('/bulk', verifyToken, requirePermission('stock.manage'), async (req, res, next) => {
    try {
        const { products, new_categories } = req.body;

        if (!Array.isArray(products) || products.length === 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: { message: 'products array is required and must not be empty' }
            });
        }

        if (products.length > 40) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: { message: 'Maximum 40 products per bulk import' }
            });
        }

        // Validate each row
        for (let i = 0; i < products.length; i++) {
            const p = products[i];
            if (!p.name || String(p.name).trim().length < 2) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    error: { message: `Row ${i + 1}: product name must be at least 2 characters` }
                });
            }
            if (p.cost_price === undefined || p.cost_price === null || isNaN(Number(p.cost_price)) || Number(p.cost_price) < 0) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    error: { message: `Row ${i + 1}: cost_price must be a non-negative number` }
                });
            }
            if (p.selling_price === undefined || p.selling_price === null || isNaN(Number(p.selling_price)) || Number(p.selling_price) < 0) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    success: false,
                    error: { message: `Row ${i + 1}: selling_price must be a non-negative number` }
                });
            }
        }

        const result = await productService.bulkCreateProducts(
            products,
            Array.isArray(new_categories) ? new_categories : [],
            req.user.id
        );

        // Fire email in the background — don't await, don't block the response
        emailService
            .sendBulkImportSummary(result.products, req.user, result.totals)
            .catch(err => logger.error(`Bulk import email failed: ${err.message}`));

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: `${result.totals.products_created} products added`,
            data: result
        });
    } catch (error) {
        logger.error(`POST /products/bulk error: ${error.message}`);
        next(error);
    }
});
/**
 * @route   GET /api/v1/products/:id/movements
 * @desc    Get inventory movements
 * @access  Private (Manager+)
 */
router.get('/:id/movements', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        const movements = await productService.getProductMovements(req.params.id, limit);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            count: movements.length,
            data: movements
        });
    } catch (error) {
        logger.error(`GET /products/:id/movements error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   POST /api/v1/products/:id/restock
 * @desc    Restock a product
 * @access  Private (Manager+)
 */
router.post('/:id/restock', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        const { quantity, branch_id } = req.body;
        
        if (!quantity || quantity <= 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Valid quantity is required'
                }
            });
        }

        const branchId = branch_id || '22222222-2222-2222-2222-222222222222';
        
        const newStock = await productService.updateStock(
            branchId,
            req.params.id,
            quantity,
            'PURCHASE',
            req.user.id,
            `RESTOCK-${Date.now()}`
        );
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Stock updated successfully',
            data: {
                product_id: req.params.id,
                branch_id: branchId,
                new_stock: newStock,
                quantity_added: quantity
            }
        });
    } catch (error) {
        logger.error(`POST /products/:id/restock error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   POST /api/v1/products
 * @desc    Create a new product
 * @access  Private (Manager+)
 */
router.post('/', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        const { error, value } = productSchema.validate(req.body);
        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Validation error',
                    details: error.details.map(d => d.message)
                }
            });
        }

        const product = await productService.createProduct(value);

        // Fire owner notification email in the background
        emailService
            .sendStockAddedNotification(product, req.user)
            .catch(err => logger.error(`Single add email failed: ${err.message}`));

        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: 'Product created successfully',
            data: product
        });
    } catch (error) {
        logger.error(`POST /products error: ${error.message}`);
        
        if (error.message && error.message.includes('duplicate key value violates unique constraint')) {
            return res.status(HTTP_STATUS.CONFLICT).json({
                success: false,
                error: {
                    message: 'Product with this SKU already exists. Please use a different SKU.'
                }
            });
        }
        
        next(error);
    }
});

/**
 * @route   GET /api/v1/products/:id
 * @desc    Get product by ID with inventory
 * @access  Private
 * ⚠️ WILDCARD ROUTE - MUST COME LAST!
 */
router.get('/:id', verifyToken, async (req, res, next) => {
    try {
        const product = await productService.getProductById(req.params.id);
        
        if (!product) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: {
                    message: 'Product not found'
                }
            });
        }
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: product
        });
    } catch (error) {
        logger.error(`GET /products/:id error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   PUT /api/v1/products/:id
 * @desc    Update a product
 * @access  Private (Manager+)
 */
router.put('/:id', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        const { error, value } = productSchema.validate(req.body);
        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Validation error',
                    details: error.details.map(d => d.message)
                }
            });
        }

        const product = await productService.updateProduct(req.params.id, value);
        
        if (!product) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: {
                    message: 'Product not found'
                }
            });
        }
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Product updated successfully',
            data: product
        });
    } catch (error) {
        logger.error(`PUT /products/:id error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   DELETE /api/v1/products/:id
 * @desc    Soft delete a product
 * @access  Private (Manager+)
 */
router.delete('/:id', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        const product = await productService.deleteProduct(req.params.id);
        
        if (!product) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: {
                    message: 'Product not found'
                }
            });
        }
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Product deleted successfully',
            data: product
        });
    } catch (error) {
        logger.error(`DELETE /products/:id error: ${error.message}`);
        next(error);
    }
});

export default router;