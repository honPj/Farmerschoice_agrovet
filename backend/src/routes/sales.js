import express from 'express';
import saleService from '../services/sale.service.js';
import { verifyToken, requireRoles } from '../middleware/auth.js';
import { 
    createSaleSchema, 
    returnSaleSchema, 
    paymentFilterSchema
} from '../validators/sale.validator.js';
import { HTTP_STATUS } from '../utils/constants.js';
import logger from '../utils/logger.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// 📂 SALE ROUTES - SPECIFIC ROUTES FIRST!
// ═══════════════════════════════════════════════════════════════

/**
 * @route   POST /api/v1/sales
 * @desc    Create a new sale
 * @access  Private
 */
router.post('/', verifyToken, async (req, res, next) => {
    try {
        console.log('📂📂📂 POST /sales route called 📂📂📂');
        
        const { error, value } = createSaleSchema.validate(req.body);
        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Validation error',
                    details: error.details.map(d => d.message)
                }
            });
        }

        const result = await saleService.createSale(value, req.user.id);
        
        res.status(HTTP_STATUS.CREATED).json({
            success: true,
            message: 'Sale created successfully',
            data: {
                sale: result.sale,
                receipt_number: result.receipt_number,
                items: result.items
            }
        });
    } catch (error) {
        console.error('🔥 POST /sales error:', error);
        logger.error(`POST /sales error: ${error.message}`);
        
        if (error.message.includes('Insufficient stock')) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: error.message
                }
            });
        }
        
        if (error.message.includes('Product not found')) {
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
 * @route   GET /api/v1/sales
 * @desc    Get all sales
 * @access  Private (Manager+)
 */
router.get('/', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /sales route called 📂📂📂');
        
        const filters = {
            start_date: req.query.start_date,
            end_date: req.query.end_date,
            payment_method: req.query.payment_method,
            payment_status: req.query.payment_status,
            branch_id: req.query.branch_id,
            user_id: req.query.user_id,
            limit: req.query.limit ? parseInt(req.query.limit) : 100
        };

        const sales = await saleService.getAllSales(filters);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            count: sales.length,
            data: sales
        });
    } catch (error) {
        console.error('🔥 GET /sales error:', error);
        logger.error(`GET /sales error: ${error.message}`);
        next(error);
    }
});

// ═══════════════════════════════════════════════════════════════
// 📂 SPECIFIC ROUTES - MUST COME BEFORE /:id
// ═══════════════════════════════════════════════════════════════

/**
 * @route   GET /api/v1/sales/my-sales
 * @desc    Get the logged-in user's own sales
 * @access  Private (any authenticated user)
 * Query: start_date, end_date, limit
 */
router.get('/my-sales', verifyToken, async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /sales/my-sales route called 📂📂📂');
        console.log('📂 user_id (from token):', req.user.id);

        const filters = {
            user_id: req.user.id,        // ← forced, cannot be spoofed by client
            start_date: req.query.start_date,
            end_date: req.query.end_date,
            limit: req.query.limit ? parseInt(req.query.limit) : 200
        };

        const sales = await saleService.getAllSales(filters);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            count: sales.length,
            data: sales
        });
    } catch (error) {
        console.error('🔥 GET /sales/my-sales error:', error);
        logger.error(`GET /sales/my-sales error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/sales/today
 * @desc    Get today's sales
 * @access  Private
 */
router.get('/today', verifyToken, async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /sales/today route called 📂📂📂');
        
        const branchId = req.query.branch_id;
        const result = await saleService.getTodaySales(branchId);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('🔥 GET /sales/today error:', error);
        logger.error(`GET /sales/today error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/sales/credit
 * @desc    Get all credit sales
 * @access  Private (Manager+)
 */
router.get('/credit', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /sales/credit route called 📂📂📂');
        
        const result = await saleService.getCreditSales();
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('🔥 GET /sales/credit error:', error);
        logger.error(`GET /sales/credit error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/sales/summary
 * @desc    Get sales summary
 * @access  Private (Manager+)
 */
router.get('/summary', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /sales/summary route called 📂📂📂');
        
        const filters = {
            start_date: req.query.start_date,
            end_date: req.query.end_date,
            branch_id: req.query.branch_id
        };

        const summary = await saleService.getSalesSummary(filters);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('🔥 GET /sales/summary error:', error);
        logger.error(`GET /sales/summary error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/sales/by-payment/:method
 * @desc    Get sales by payment method
 * @access  Private (Manager+)
 */
router.get('/by-payment/:method', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log(`📂📂📂 GET /sales/by-payment/:method called for: ${req.params.method}`);
        
        const { error, value } = paymentFilterSchema.validate({ method: req.params.method });
        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Invalid payment method'
                }
            });
        }

        const filters = {
            start_date: req.query.start_date,
            end_date: req.query.end_date
        };

        const result = await saleService.getSalesByPaymentMethod(value.method, filters);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error(`🔥 GET /sales/by-payment/:method error:`, error);
        logger.error(`GET /sales/by-payment/:method error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/sales/receipt/:number
 * @desc    Get sale by receipt number
 * @access  Private
 */
router.get('/receipt/:number', verifyToken, async (req, res, next) => {
    try {
        console.log(`📂📂📂 GET /sales/receipt/:number called for: ${req.params.number}`);
        
        const sale = await saleService.getSaleByReceipt(req.params.number);
        
        if (!sale) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: {
                    message: 'Sale not found'
                }
            });
        }
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: sale
        });
    } catch (error) {
        console.error(`🔥 GET /sales/receipt/:number error:`, error);
        logger.error(`GET /sales/receipt/:number error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   POST /api/v1/sales/:id/return
 * @desc    Process a return/refund
 * @access  Private (Manager+)
 */
router.post('/:id/return', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log(`📂📂📂 POST /sales/:id/return called for: ${req.params.id}`);
        
        const { error, value } = returnSaleSchema.validate(req.body);
        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Validation error',
                    details: error.details.map(d => d.message)
                }
            });
        }

        const result = await saleService.processReturn(req.params.id, value, req.user.id);
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Return processed successfully',
            data: result
        });
    } catch (error) {
        console.error(`🔥 POST /sales/:id/return error:`, error);
        logger.error(`POST /sales/:id/return error: ${error.message}`);
        
        if (error.message.includes('already been refunded')) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: error.message
                }
            });
        }
        
        if (error.message.includes('Sale not found')) {
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

// ═══════════════════════════════════════════════════════════════
// ⚠️ WILDCARD ROUTE - MUST COME LAST!
// ═══════════════════════════════════════════════════════════════

/**
 * @route   GET /api/v1/sales/:id
 * @desc    Get sale by ID
 * @access  Private
 * ⚠️ WILDCARD ROUTE - MUST BE LAST!
 */
router.get('/:id', verifyToken, async (req, res, next) => {
    try {
        console.log(`📂📂📂 GET /sales/:id route called for: ${req.params.id}`);
        
        const sale = await saleService.getSaleById(req.params.id);
        
        if (!sale) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                error: {
                    message: 'Sale not found'
                }
            });
        }
        
        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: sale
        });
    } catch (error) {
        console.error(`🔥 GET /sales/:id error:`, error);
        logger.error(`GET /sales/:id error: ${error.message}`);
        next(error);
    }
});

export default router;