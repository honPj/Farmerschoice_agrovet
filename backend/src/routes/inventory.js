import express from 'express';
import inventoryService from '../services/inventory.service.js';
import { verifyToken, requireRoles } from '../middleware/auth.js';
import {
    updateStockSchema,
    transferStockSchema,
    adjustStockSchema,
    inventoryFilterSchema
} from '../validators/inventory.validator.js';
import { HTTP_STATUS } from '../utils/constants.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * @route   GET /api/v1/inventory
 * @desc    Get all inventory with filters
 * @access  Private
 */
router.get('/', verifyToken, async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /inventory route called 📂📂📂');
        
        const filters = {
            branch_id: req.query.branch_id,
            search: req.query.search,
            min_stock: req.query.min_stock ? parseInt(req.query.min_stock) : undefined,
            max_stock: req.query.max_stock ? parseInt(req.query.max_stock) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit) : 100
        };

        const inventory = await inventoryService.getAllInventory(filters);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            count: inventory.length,
            data: inventory
        });
    } catch (error) {
        console.error('🔥 GET /inventory error:', error);
        logger.error(`GET /inventory error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/inventory/product/:productId
 * @desc    Get inventory for a specific product
 * @access  Private
 */
router.get('/product/:productId', verifyToken, async (req, res, next) => {
    try {
        console.log(`📂📂📂 GET /inventory/product/:productId called for: ${req.params.productId}`);
        
        const branchId = req.query.branch_id;
        const inventory = await inventoryService.getProductInventory(req.params.productId, branchId);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            count: inventory.length,
            data: inventory
        });
    } catch (error) {
        console.error(`🔥 GET /inventory/product/:productId error:`, error);
        logger.error(`GET /inventory/product/:productId error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   POST /api/v1/inventory/update-stock
 * @desc    Update stock for a product
 * @access  Private (Manager+)
 */
router.post('/update-stock', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log('📂📂📂 POST /inventory/update-stock called 📂📂📂');
        
        const { error, value } = updateStockSchema.validate(req.body);
        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Validation error',
                    details: error.details.map(d => d.message)
                }
            });
        }

        const { branch_id, product_id, quantity, movement_type, notes } = value;
        
        const newStock = await inventoryService.updateStock(
            branch_id,
            product_id,
            quantity,
            movement_type,
            req.user.id,
            notes
        );
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Stock updated successfully',
            data: {
                branch_id,
                product_id,
                new_stock: newStock,
                quantity_changed: quantity,
                movement_type
            }
        });
    } catch (error) {
        console.error('🔥 POST /inventory/update-stock error:', error);
        logger.error(`POST /inventory/update-stock error: ${error.message}`);
        
        if (error.message.includes('Insufficient stock')) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: error.message
                }
            });
        }
        
        if (error.message.includes('Product not found in branch inventory')) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: {
                    message: error.message
                }
            });
        }
        
        next(error);
    }
});

/**
 * @route   POST /api/v1/inventory/transfer
 * @desc    Transfer stock between branches
 * @access  Private (Manager+)
 */
router.post('/transfer', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log('📂📂📂 POST /inventory/transfer called 📂📂📂');
        
        const { error, value } = transferStockSchema.validate(req.body);
        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Validation error',
                    details: error.details.map(d => d.message)
                }
            });
        }

        const result = await inventoryService.transferStock(value, req.user.id);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Stock transferred successfully',
            data: result
        });
    } catch (error) {
        console.error('🔥 POST /inventory/transfer error:', error);
        logger.error(`POST /inventory/transfer error: ${error.message}`);
        
        if (error.message.includes('Insufficient stock')) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: error.message
                }
            });
        }
        
        next(error);
    }
});

/**
 * @route   GET /api/v1/inventory/movements
 * @desc    Get inventory movements with filters
 * @access  Private (Manager+)
 */
router.get('/movements', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /inventory/movements called 📂📂📂');
        
        const filters = {
            branch_id: req.query.branch_id,
            product_id: req.query.product_id,
            movement_type: req.query.movement_type,
            start_date: req.query.start_date,
            end_date: req.query.end_date,
            limit: req.query.limit ? parseInt(req.query.limit) : 100
        };

        const movements = await inventoryService.getInventoryMovements(filters);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            count: movements.length,
            data: movements
        });
    } catch (error) {
        console.error('🔥 GET /inventory/movements error:', error);
        logger.error(`GET /inventory/movements error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/inventory/low-stock
 * @desc    Get low stock products
 * @access  Private
 */
router.get('/low-stock', verifyToken, async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /inventory/low-stock called 📂📂📂');
        
        const threshold = req.query.threshold ? parseInt(req.query.threshold) : 5;
        const branchId = req.query.branch_id;
        
        const products = await inventoryService.getLowStockProducts(threshold, branchId);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        console.error('🔥 GET /inventory/low-stock error:', error);
        logger.error(`GET /inventory/low-stock error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/inventory/summary
 * @desc    Get stock value summary
 * @access  Private (Manager+)
 */
router.get('/summary', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /inventory/summary called 📂📂📂');
        
        const branchId = req.query.branch_id;
        const summary = await inventoryService.getStockValueSummary(branchId);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('🔥 GET /inventory/summary error:', error);
        logger.error(`GET /inventory/summary error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/inventory/branch/:branchId/summary
 * @desc    Get detailed branch inventory summary
 * @access  Private (Manager+)
 */
router.get('/branch/:branchId/summary', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log(`📂📂📂 GET /inventory/branch/:branchId/summary called for: ${req.params.branchId}`);
        
        const summary = await inventoryService.getBranchInventorySummary(req.params.branchId);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error(`🔥 GET /inventory/branch/:branchId/summary error:`, error);
        logger.error(`GET /inventory/branch/:branchId/summary error: ${error.message}`);
        next(error);
    }
});

export default router;