import express from 'express';
import reportService from '../services/report.service.js';
import { verifyToken, requireRoles } from '../middleware/auth.js';
import {
    dateRangeSchema,
    yearSchema,
    monthSchema,
    weekSchema,
    topProductsSchema
} from '../validators/report.validator.js';
import { HTTP_STATUS } from '../utils/constants.js';
import logger from '../utils/logger.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// 📊 REPORT ROUTES - SPECIFIC ROUTES FIRST!
// ═══════════════════════════════════════════════════════════════

/**
 * @route   GET /api/v1/reports/daily
 * @desc    Get daily sales report
 * @access  Private (Manager+)
 */
router.get('/daily', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /reports/daily called 📂📂📂');

        const { error, value } = dateRangeSchema.validate({
            start_date: req.query.date,
            end_date: req.query.date
        });

        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Validation error',
                    details: error.details.map(d => d.message)
                }
            });
        }

        const date = req.query.date || new Date().toISOString().split('T')[0];
        const branchId = req.query.branch_id;

        const report = await reportService.getDailyReport(date, branchId);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('🔥 GET /reports/daily error:', error);
        logger.error(`GET /reports/daily error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/reports/weekly
 * @desc    Get weekly sales report
 * @access  Private (Manager+)
 */
router.get('/weekly', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /reports/weekly called 📂📂📂');

        const { error, value } = weekSchema.validate({
            year: parseInt(req.query.year),
            week: parseInt(req.query.week)
        });

        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Validation error',
                    details: error.details.map(d => d.message)
                }
            });
        }

        const { year, week } = value;
        const branchId = req.query.branch_id;

        const report = await reportService.getWeeklyReport(year, week, branchId);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('🔥 GET /reports/weekly error:', error);
        logger.error(`GET /reports/weekly error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/reports/monthly
 * @desc    Get monthly sales report
 * @access  Private (Manager+)
 */
router.get('/monthly', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /reports/monthly called 📂📂📂');

        const { error, value } = monthSchema.validate({
            year: parseInt(req.query.year),
            month: parseInt(req.query.month)
        });

        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Validation error',
                    details: error.details.map(d => d.message)
                }
            });
        }

        const { year, month } = value;
        const branchId = req.query.branch_id;

        const report = await reportService.getMonthlyReport(year, month, branchId);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('🔥 GET /reports/monthly error:', error);
        logger.error(`GET /reports/monthly error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/reports/yearly
 * @desc    Get yearly sales report
 * @access  Private (Manager+)
 */
router.get('/yearly', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /reports/yearly called 📂📂📂');

        const { error, value } = yearSchema.validate({
            year: parseInt(req.query.year)
        });

        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Validation error',
                    details: error.details.map(d => d.message)
                }
            });
        }

        const { year } = value;
        const branchId = req.query.branch_id;

        const report = await reportService.getYearlyReport(year, branchId);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('🔥 GET /reports/yearly error:', error);
        logger.error(`GET /reports/yearly error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/reports/custom
 * @desc    Get custom date range report
 * @access  Private (Manager+)
 */
router.get('/custom', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /reports/custom called 📂📂📂');

        const { error, value } = dateRangeSchema.validate({
            start_date: req.query.start_date,
            end_date: req.query.end_date
        });

        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Validation error',
                    details: error.details.map(d => d.message)
                }
            });
        }

        const startDate = new Date(value.start_date);
        const endDate = new Date(value.end_date);
        const branchId = req.query.branch_id;

        const report = await reportService.getCustomReport(startDate, endDate, branchId);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('🔥 GET /reports/custom error:', error);
        logger.error(`GET /reports/custom error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/reports/payment-breakdown
 * @desc    Get payment breakdown report
 * @access  Private (Manager+)
 */
router.get('/payment-breakdown', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /reports/payment-breakdown called 📂📂📂');

        const { error, value } = dateRangeSchema.validate({
            start_date: req.query.start_date,
            end_date: req.query.end_date
        });

        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Validation error',
                    details: error.details.map(d => d.message)
                }
            });
        }

        const startDate = new Date(value.start_date);
        const endDate = new Date(value.end_date);
        const branchId = req.query.branch_id;

        const report = await reportService.getPaymentBreakdownReport(startDate, endDate, branchId);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('🔥 GET /reports/payment-breakdown error:', error);
        logger.error(`GET /reports/payment-breakdown error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/reports/top-products
 * @desc    Get top selling products
 * @access  Private (Manager+)
 */
router.get('/top-products', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /reports/top-products called 📂📂📂');

        const { error, value } = topProductsSchema.validate({
            limit: req.query.limit ? parseInt(req.query.limit) : 10,
            start_date: req.query.start_date,
            end_date: req.query.end_date
        });

        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Validation error',
                    details: error.details.map(d => d.message)
                }
            });
        }

        const { limit, start_date, end_date } = value;
        const branchId = req.query.branch_id;

        const startDate = start_date ? new Date(start_date) : null;
        const endDate = end_date ? new Date(end_date) : null;

        const products = await reportService.getTopProducts(limit, startDate, endDate, branchId);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        console.error('🔥 GET /reports/top-products error:', error);
        logger.error(`GET /reports/top-products error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/reports/employee-performance
 * @desc    Get employee performance report
 * @access  Private (Manager+)
 */
router.get('/employee-performance', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /reports/employee-performance called 📂📂📂');

        const { error, value } = dateRangeSchema.validate({
            start_date: req.query.start_date,
            end_date: req.query.end_date
        });

        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Validation error',
                    details: error.details.map(d => d.message)
                }
            });
        }

        const startDate = new Date(value.start_date);
        const endDate = new Date(value.end_date);
        const branchId = req.query.branch_id;

        const performance = await reportService.getEmployeePerformanceReport(startDate, endDate, branchId);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            count: performance.length,
            data: performance
        });
    } catch (error) {
        console.error('🔥 GET /reports/employee-performance error:', error);
        logger.error(`GET /reports/employee-performance error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/reports/stock-value
 * @desc    Get stock value report
 * @access  Private (Manager+)
 */
router.get('/stock-value', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /reports/stock-value called 📂📂📂');

        const branchId = req.query.branch_id;
        const report = await reportService.getStockValueReport(branchId);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('🔥 GET /reports/stock-value error:', error);
        logger.error(`GET /reports/stock-value error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/reports/profit-loss
 * @desc    Get profit & loss report
 * @access  Private (Manager+)
 */
router.get('/profit-loss', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /reports/profit-loss called 📂📂📂');

        const { error, value } = dateRangeSchema.validate({
            start_date: req.query.start_date,
            end_date: req.query.end_date
        });

        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Validation error',
                    details: error.details.map(d => d.message)
                }
            });
        }

        const startDate = new Date(value.start_date);
        const endDate = new Date(value.end_date);
        const branchId = req.query.branch_id;

        const report = await reportService.getProfitLossReport(startDate, endDate, branchId);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('🔥 GET /reports/profit-loss error:', error);
        logger.error(`GET /reports/profit-loss error: ${error.message}`);
        next(error);
    }
});
/**
 * @route   GET /api/v1/reports/stock-movement
 * @desc    Get stock movement report (fast → slow moving products)
 * @access  Private (Manager+)
 */
router.get('/stock-movement', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /reports/stock-movement called 📂📂📂');

        const { error, value } = dateRangeSchema.validate({
            start_date: req.query.start_date,
            end_date: req.query.end_date
        });

        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: {
                    message: 'Validation error',
                    details: error.details.map(d => d.message)
                }
            });
        }

        const limit = req.query.limit ? parseInt(req.query.limit) : 100;
        const branchId = req.query.branch_id;

        const startDate = new Date(value.start_date);
        const endDate = new Date(value.end_date);

        const report = await reportService.getStockMovementReport(startDate, endDate, limit, branchId);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('🔥 GET /reports/stock-movement error:', error);
        logger.error(`GET /reports/stock-movement error: ${error.message}`);
        next(error);
    }
});
/**
 * @route   GET /api/v1/reports/stock-movement-v2
 * @desc    Full products list with velocity — includes zero-movement products
 * @access  Private (Manager+)
 */
router.get('/stock-movement-v2', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        const { error, value } = dateRangeSchema.validate({
            start_date: req.query.start_date,
            end_date: req.query.end_date
        });
        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: { message: 'Validation error', details: error.details.map(d => d.message) }
            });
        }

        const limit = req.query.limit ? parseInt(req.query.limit) : 500;
        const branchId = req.query.branch_id;
        const startDate = new Date(value.start_date);
        const endDate = new Date(value.end_date);

        const report = await reportService.getStockMovementReportV2(startDate, endDate, limit, branchId);

        res.status(HTTP_STATUS.OK).json({ success: true, data: report });
    } catch (error) {
        logger.error(`GET /reports/stock-movement-v2 error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/reports/category-report
 * @desc    Get per-category revenue/profit report
 * @access  Private (Manager+)
 */
router.get('/category-report', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        const { error, value } = dateRangeSchema.validate({
            start_date: req.query.start_date,
            end_date: req.query.end_date
        });
        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: { message: 'Validation error', details: error.details.map(d => d.message) }
            });
        }

        const branchId = req.query.branch_id;
        const startDate = new Date(value.start_date);
        const endDate = new Date(value.end_date);

        const report = await reportService.getCategoryReport(startDate, endDate, branchId);

        res.status(HTTP_STATUS.OK).json({ success: true, data: report });
    } catch (error) {
        logger.error(`GET /reports/category-report error: ${error.message}`);
        next(error);
    }
});

/**
 * @route   GET /api/v1/reports/payment-breakdown-v2
 * @desc    Payment breakdown with optional payment_method filter
 * @access  Private (Manager+)
 */
router.get('/payment-breakdown-v2', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        const { error, value } = dateRangeSchema.validate({
            start_date: req.query.start_date,
            end_date: req.query.end_date
        });
        if (error) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: { message: 'Validation error', details: error.details.map(d => d.message) }
            });
        }

        const branchId = req.query.branch_id;
        const paymentMethod = req.query.payment_method || null;
        const startDate = new Date(value.start_date);
        const endDate = new Date(value.end_date);

        const report = await reportService.getPaymentBreakdownReportFiltered(
            startDate, endDate, paymentMethod, branchId
        );

        res.status(HTTP_STATUS.OK).json({ success: true, data: report });
    } catch (error) {
        logger.error(`GET /reports/payment-breakdown-v2 error: ${error.message}`);
        next(error);
    }
});
/**
 * @route   GET /api/v1/reports/analytics-summary
 * @desc    Get comprehensive analytics summary (all-in-one for the Analytics dashboard)
 * @access  Private (Manager+)
 * Query:   days=7|14|30|90 (default 30), branch_id (optional)
 */
router.get('/analytics-summary', verifyToken, requireRoles(['owner', 'manager']), async (req, res, next) => {
    try {
        console.log('📂📂📂 GET /reports/analytics-summary called 📂📂📂');

        const days = req.query.days ? parseInt(req.query.days) : 30;
        const branchId = req.query.branch_id;

        if (![7, 14, 30, 90].includes(days)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                error: { message: 'days must be one of: 7, 14, 30, 90' }
            });
        }

        const report = await reportService.getAnalyticsSummary(days, branchId);

        res.status(HTTP_STATUS.OK).json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('🔥 GET /reports/analytics-summary error:', error);
        logger.error(`GET /reports/analytics-summary error: ${error.message}`);
        next(error);
    }
});

export default router;